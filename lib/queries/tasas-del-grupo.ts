import { and, between, eq, isNull, ne, or, sql } from "drizzle-orm";
import { calls, deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveCloserSql, claveDeCloserSql } from "@/lib/closers/identidad";
import { ETAPAS_VENDIDAS, type EtapaDeal } from "@/lib/deals/etapas";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fechaAnclaCall } from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";
import type { Rango } from "@/lib/queries/dashboard";

/**
 * Las tasas del embudo comercial sobre el MISMO grupo de personas (ADR 0079, ticket 187).
 *
 * El grupo es la cohorte de citas del rango: los deals vigentes del programa, sin cortesías, con al
 * menos una cita YA OCURRIDA cuya fecha cae en el rango. "Ocurrida" es que su hora ya pasó; entran
 * el show, el no-show, la cancelada y la que sigue sin resultado (cuenta como no-show hasta que se
 * registre). La reagendada no entra: la representa su cita nueva (decidido el 5-oct).
 *
 * Se cuenta por deal, no por llamada, y la cadena entera sale del grupo:
 *  - % de show     = deals con al menos un show ÷ deals del grupo;
 *  - % de cierre   = deals con show que HOY están vendidos ÷ deals con show;
 *  - agenda → venta = deals con show vendidos hoy ÷ deals del grupo.
 * Por eso % show × % cierre = agenda → venta, siempre. Un deal vendido sin show en el rango no entra
 * a la cadena: sí cuenta en las ventas del periodo, que son cantidades por fecha y no cambian (punto 6).
 *
 * Por closer, cada deal se atribuye UNA vez: a quien tomó su último show del rango (ADR 0079 punto 4)
 * o, si no hubo show, a quien tenía su última cita. Así la cadena del closer también cuadra y la suma
 * de los grupos de los closers es el grupo del programa.
 *
 * La cuenta es pura (`calcularTasasDelGrupo`); la lectura (`leerCitasDelGrupo`) la alimenta. Lo
 * importan el dashboard, el comparativo, Mi espacio y la lista de cada tasa: una sola definición.
 */

export const DIAS_PARA_MADURAR = 30;

/** El resultado que saca una cita del grupo: se movió, y la representa su cita nueva. */
const RESULTADOS_FUERA_DEL_GRUPO = ["reagendada"] as const;

export interface CitaParaTasas {
  callId: string;
  dealId: string;
  /** La clave de identidad del closer de la llamada (ticket 167): `users.id` o `historico:<texto>`. */
  claveCloser: string;
  closer: string | null;
  resultado: string;
  /** El instante de la cita: `fecha_agenda`, o `fecha_llamada` en las filas viejas. */
  instante: Date;
  etapa: EtapaDeal;
}

/** Un deal del grupo, con lo que hace falta para su lista. */
export interface MiembroDelGrupo {
  dealId: string;
  /** La cita que lo atribuye: su último show o, sin show, su última cita del rango. */
  callId: string;
  fecha: string;
  claveCloser: string;
  closer: string | null;
  etapa: EtapaDeal;
  conShow: boolean;
  vendido: boolean;
}

export interface TasasDelGrupo {
  deals: number;
  conShow: number;
  /** Deals con show que hoy están vendidos. */
  vendidos: number;
  pctShow: number | null;
  pctCierre: number | null;
  agendaAVenta: number | null;
}

export interface GrupoDeCitas {
  miembros: MiembroDelGrupo[];
  tasas: TasasDelGrupo;
  /** Las mismas tasas por clave de closer; cada deal cuenta en un solo closer. */
  porCloser: Map<string, TasasDelGrupo & { closer: string | null }>;
  /** El rango termina hace menos de 30 días: las ventas de su grupo todavía pueden llegar. */
  madurando: boolean;
}

function dividir(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

function tasasDe(miembros: readonly MiembroDelGrupo[]): TasasDelGrupo {
  const conShow = miembros.filter((m) => m.conShow).length;
  const vendidos = miembros.filter((m) => m.conShow && m.vendido).length;
  return {
    deals: miembros.length,
    conShow,
    vendidos,
    pctShow: dividir(conShow, miembros.length),
    pctCierre: dividir(vendidos, conShow),
    agendaAVenta: dividir(vendidos, miembros.length),
  };
}

function numeroDeDia(fecha: string): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / 86_400_000);
}

export function esShow(resultado: string): boolean {
  return (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(resultado);
}

/** ¿El rango termina hace menos de 30 días? Las dos fechas son días de Bogotá. */
export function rangoMadurando(rango: Rango, hoy: string): boolean {
  return numeroDeDia(hoy) - numeroDeDia(rango.hasta) < DIAS_PARA_MADURAR;
}

/**
 * La cuenta, sin base ni reloj. `citas` ya viene acotada al programa, al rango y a lo vigente;
 * aquí se decide qué cita ya ocurrió (`ahora`), quién se queda el deal y la cadena.
 */
export function calcularTasasDelGrupo(args: {
  citas: readonly CitaParaTasas[];
  rango: Rango;
  hoy: string;
  ahora: Date;
}): GrupoDeCitas {
  const ocurridas = args.citas
    .filter((c) => !(RESULTADOS_FUERA_DEL_GRUPO as readonly string[]).includes(c.resultado))
    .filter((c) => c.instante.getTime() <= args.ahora.getTime())
    .sort((a, b) => a.instante.getTime() - b.instante.getTime() || a.callId.localeCompare(b.callId));

  const porDeal = new Map<string, CitaParaTasas[]>();
  for (const cita of ocurridas) {
    const lista = porDeal.get(cita.dealId) ?? [];
    lista.push(cita);
    porDeal.set(cita.dealId, lista);
  }

  const miembros: MiembroDelGrupo[] = [...porDeal.values()].map((citasDelDeal) => {
    const shows = citasDelDeal.filter((c) => esShow(c.resultado));
    const atribuye = (shows.length > 0 ? shows : citasDelDeal).at(-1)!;
    return {
      dealId: atribuye.dealId,
      callId: atribuye.callId,
      fecha: diaDeCalendario(atribuye.instante),
      claveCloser: atribuye.claveCloser,
      closer: atribuye.closer,
      etapa: atribuye.etapa,
      conShow: shows.length > 0,
      vendido: ETAPAS_VENDIDAS.includes(atribuye.etapa),
    };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.dealId.localeCompare(b.dealId));

  const agrupados = new Map<string, MiembroDelGrupo[]>();
  for (const miembro of miembros) {
    const lista = agrupados.get(miembro.claveCloser) ?? [];
    lista.push(miembro);
    agrupados.set(miembro.claveCloser, lista);
  }
  const porCloser = new Map(
    [...agrupados].map(([clave, lista]) => [clave, { ...tasasDe(lista), closer: lista[0]!.closer }]),
  );

  return { miembros, tasas: tasasDe(miembros), porCloser, madurando: rangoMadurando(args.rango, args.hoy) };
}

/** Los miembros de un closer, o todos si no hay clave. Es el filtro que usan la cifra y su lista. */
export function miembrosDe(grupo: GrupoDeCitas, claveCloser: string | null | undefined): MiembroDelGrupo[] {
  return claveCloser ? grupo.miembros.filter((m) => m.claveCloser === claveCloser) : grupo.miembros;
}

/** Las tasas del programa o, con clave, las del closer (ceros si no tiene grupo). */
export function tasasDelAlcance(grupo: GrupoDeCitas, claveCloser: string | null | undefined): TasasDelGrupo {
  return claveCloser ? tasasDe(miembrosDe(grupo, claveCloser)) : grupo.tasas;
}

/**
 * Lee las citas del programa en el rango, de deals vigentes y no cortesía, con la clave del closer
 * resuelta como en el comparativo (FK, o el texto viejo de un usuario con cuenta).
 */
export async function leerCitasDelGrupo(
  db: Db,
  { programId, rango }: { programId: string; rango: Rango },
): Promise<CitaParaTasas[]> {
  const filas = await db
    .select({
      callId: calls.id,
      dealId: deals.id,
      claveCloser: claveCloserSql(users.id, calls.closerId),
      closer: sql<string | null>`coalesce(${users.closerId}, ${users.nombre}, ${users.email}, ${calls.closerId})`,
      resultado: calls.resultado,
      fechaAgenda: calls.fechaAgenda,
      fechaLlamada: calls.fechaLlamada,
      etapa: deals.etapa,
    })
    .from(calls)
    .innerJoin(deals, and(
      eq(deals.id, calls.dealId),
      eq(deals.programId, calls.programId),
      eq(deals.cortesia, false),
      vigente(deals),
    ))
    .leftJoin(
      users,
      or(
        eq(users.id, calls.closerUserId),
        and(
          isNull(calls.closerUserId),
          eq(claveDeCloserSql(users.closerId), claveDeCloserSql(calls.closerId)),
        ),
      ),
    )
    .where(and(
      eq(calls.programId, programId),
      between(fechaAnclaCall(), rango.desde, rango.hasta),
      ne(calls.resultado, "reagendada"),
      vigente(calls),
    ));

  return filas.flatMap((fila) => {
    const instante = fila.fechaAgenda ?? fila.fechaLlamada;
    if (!instante) return [];
    return [{
      callId: fila.callId,
      dealId: fila.dealId,
      claveCloser: fila.claveCloser,
      closer: fila.closer,
      resultado: fila.resultado,
      instante,
      etapa: fila.etapa,
    }];
  });
}

/** Lectura y cuenta juntas, para quien solo quiere el grupo del rango. */
export async function grupoDeCitas(
  db: Db,
  { programId, rango, ahora }: { programId: string; rango: Rango; ahora: Date },
): Promise<GrupoDeCitas> {
  const citas = await leerCitasDelGrupo(db, { programId, rango });
  return calcularTasasDelGrupo({ citas, rango, hoy: diaDeCalendario(ahora), ahora });
}
