import { and, inArray } from "drizzle-orm";
import { calls, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { tableroKanban, type TarjetaDeal } from "@/lib/queries/kanban";
import type { AlcanceDeals } from "@/lib/auth/alcance-deals";
import { vigente } from "@/lib/queries/vigente";
import { posiblesDuplicadosDelPrograma } from "@/lib/queries/leads";
import { novedadesCalendlyDeUsuario } from "@/lib/notificaciones-calendly/notificaciones";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";

/**
 * Las Notificaciones de Mi espacio (ticket 222): lo que le toca al closer HOY, por tipo,
 * con las MISMAS tarjetas de deal que ve en Deals. Este módulo es la ÚNICA respuesta por
 * chip: un predicado por chip que usan el conteo, la lista y (223) el circulito.
 *
 * El universo es siempre los deals de la sesión como dueño en el programa elegido
 * (`tableroKanban` con alcance `dueno`): así un deal de otro programa o de otro dueño no
 * puede aparecer en ningún chip, porque nunca entra al universo. Los datos que a la
 * tarjeta le faltan (la fecha de seguimiento y la fecha límite de pago del deal, ambas
 * `date`, y las llamadas vigentes) salen de UNA lectura extra cada uno, por `inArray` sobre
 * los ids del universo; las llamadas pasan por `vigente(calls)` (obligatorio: lo exige el
 * guardián de vigencia). Las comparaciones de día son en Bogotá (`diaDeCalendario`).
 */

/** Los chips, en el orden en que se muestran. El primero es el que manda por defecto. */
export const CHIPS_NOTIFICACIONES = [
  "hoy",
  "reagenda",
  "seguimiento",
  "proxima_cohorte",
  "vencidos",
  "calendly",
  "nuevos",
  "duplicados",
] as const;

export type ChipNotificacion = (typeof CHIPS_NOTIFICACIONES)[number];

export const CHIP_POR_DEFECTO: ChipNotificacion = "hoy";

/** Las etiquetas en español de cada chip, para la UI. */
export const NOMBRE_DE_CHIP: Readonly<Record<ChipNotificacion, string>> = {
  hoy: "Hoy",
  reagenda: "Re-agenda",
  seguimiento: "Seguimiento",
  proxima_cohorte: "Próxima Cohorte",
  vencidos: "Vencidos",
  calendly: "Calendly",
  nuevos: "Nuevos",
  duplicados: "Duplicados",
};

/** El `?chip=` de la URL, caído a `hoy` si no es uno conocido. */
export function chipPedido(valor: string | undefined): ChipNotificacion {
  return CHIPS_NOTIFICACIONES.includes(valor as ChipNotificacion)
    ? (valor as ChipNotificacion)
    : CHIP_POR_DEFECTO;
}

export const POR_PAGINA = 24;

/** Lo extra que la tarjeta no trae: las dos fechas `date` del deal. */
interface FechasDeDeal {
  fechaSeguimiento: string | null;
  fechaLimitePago: string | null;
}

/** Una tarjeta ya resuelta para un chip, con la fecha que ese chip ordena y muestra. */
export interface TarjetaNotificacion {
  tarjeta: TarjetaDeal;
  /** La fecha que importa en el chip activo (día de calendario o instante), o `null`. */
  fechaClave: Date | string | null;
}

export interface ResultadoChip {
  chip: ChipNotificacion;
  /** El conteo total del chip (todas las páginas), igual a la longitud de la lista completa. */
  total: number;
  /** La página pedida (24 por página). */
  tarjetas: TarjetaDeal[];
  /** La fecha más próxima del chip, cuando el chip tiene fecha; para la línea de resumen. */
  proxima: Date | string | null;
}

/** El universo + lo extra, leído una sola vez y reutilizado por todos los predicados. */
interface Universo {
  tarjetas: TarjetaDeal[];
  /** Fechas `date` del deal, por dealId. */
  fechas: Map<string, FechasDeDeal>;
  /** El día de Bogotá de la llamada vigente más reciente de cada deal, por dealId. */
  diaUltimaLlamada: Map<string, string>;
  /** Instante de la llamada vigente más reciente de cada deal, para ordenar "hoy". */
  instanteUltimaLlamada: Map<string, Date>;
  hoy: string;
}

async function cargarUniverso(
  db: Db,
  programId: string,
  userId: string,
  hoy: string,
): Promise<Universo> {
  const alcance: AlcanceDeals = { tipo: "dueno", userId };
  const tablero = await tableroKanban(db, programId, alcance, {}, hoy);
  const tarjetas = tablero.columnas.flatMap((c) => c.tarjetas);
  const ids = tarjetas.map((t) => t.dealId);

  const fechas = new Map<string, FechasDeDeal>();
  const diaUltimaLlamada = new Map<string, string>();
  const instanteUltimaLlamada = new Map<string, Date>();
  if (ids.length > 0) {
    const filasDeal = await db
      .select({
        dealId: deals.id,
        fechaSeguimiento: deals.fechaSeguimiento,
        fechaLimitePago: deals.fechaLimitePago,
      })
      .from(deals)
      .where(and(inArray(deals.id, ids), vigente(deals)));
    for (const f of filasDeal) {
      fechas.set(f.dealId, {
        fechaSeguimiento: f.fechaSeguimiento,
        fechaLimitePago: f.fechaLimitePago,
      });
    }

    // Llamadas VIGENTES de los deals del universo (vigente(calls) obligatorio). Nos quedamos
    // con la más reciente por deal; la fecha de la llamada es un timestamp (instante).
    const filasCall = await db
      .select({ dealId: calls.dealId, fechaLlamada: calls.fechaLlamada })
      .from(calls)
      .where(and(inArray(calls.dealId, ids), vigente(calls)));
    for (const c of filasCall) {
      if (!c.dealId || !c.fechaLlamada) continue;
      const previo = instanteUltimaLlamada.get(c.dealId);
      if (!previo || c.fechaLlamada > previo) {
        instanteUltimaLlamada.set(c.dealId, c.fechaLlamada);
        diaUltimaLlamada.set(c.dealId, diaDeCalendario(c.fechaLlamada));
      }
    }
  }

  return { tarjetas, fechas, diaUltimaLlamada, instanteUltimaLlamada, hoy };
}

/** ¿La tarjeta pasa el chip? Y, de pasar, ¿cuál es su fecha clave para ordenar y mostrar? */
function evaluar(
  u: Universo,
  t: TarjetaDeal,
  chip: ChipNotificacion,
  idsCalendly: Set<string>,
  idsDuplicados: Set<string>,
): { pasa: boolean; fechaClave: Date | string | null } {
  const fechas = u.fechas.get(t.dealId);
  const seguimiento = fechas?.fechaSeguimiento ?? null;
  const limitePago = fechas?.fechaLimitePago ?? null;
  const diaLlamada = u.diaUltimaLlamada.get(t.dealId) ?? null;
  const instanteLlamada = u.instanteUltimaLlamada.get(t.dealId) ?? null;

  switch (chip) {
    case "hoy": {
      const llamadaHoy = diaLlamada === u.hoy;
      const pendienteHoy =
        (t.pendiente === "reagenda" || t.pendiente === "seguimiento") &&
        seguimiento != null &&
        seguimiento === u.hoy;
      // Orden "hoy": por la hora de la llamada y luego por la fecha de seguimiento.
      return { pasa: llamadaHoy || pendienteHoy, fechaClave: instanteLlamada ?? seguimiento };
    }
    case "reagenda":
      return { pasa: t.pendiente === "reagenda", fechaClave: seguimiento };
    case "seguimiento":
      return { pasa: t.pendiente === "seguimiento", fechaClave: seguimiento };
    case "proxima_cohorte":
      return { pasa: t.pendiente === "proxima_cohorte", fechaClave: t.creadoEn };
    case "vencidos": {
      // Los avisos propios de la tarjeta, no reescritos (sin Grain: ver nota del módulo).
      const vencido =
        t.avisos.seguimientoVencido || t.avisos.compromisoVencido || t.avisos.carteraVencida;
      // La fecha vencida más antigua: el seguimiento o el límite de pago, el menor de los dos.
      const candidatas = [
        t.avisos.seguimientoVencido ? seguimiento : null,
        (t.avisos.compromisoVencido || t.avisos.carteraVencida) ? limitePago : null,
      ].filter((x): x is string => x != null);
      const masAntigua = candidatas.length > 0 ? candidatas.sort()[0] : null;
      return { pasa: vencido, fechaClave: masAntigua };
    }
    case "calendly":
      return { pasa: idsCalendly.has(t.dealId), fechaClave: t.ultimaActividadEn };
    case "nuevos":
      return { pasa: t.esNuevo, fechaClave: t.creadoEn };
    case "duplicados":
      return { pasa: idsDuplicados.has(t.dealId), fechaClave: t.creadoEn };
  }
}

/** El comparador de orden de cada chip, sobre las tarjetas ya evaluadas (con su fecha clave). */
function compararPorChip(
  chip: ChipNotificacion,
  a: TarjetaNotificacion,
  b: TarjetaNotificacion,
): number {
  const fa = valorDeFecha(a.fechaClave);
  const fb = valorDeFecha(b.fechaClave);
  switch (chip) {
    case "hoy":
      // Por hora de llamada y luego fecha de seguimiento, ascendente (lo más próximo primero).
      return (fa - fb) || desempate(a, b);
    case "reagenda":
    case "seguimiento":
      // Por fecha de seguimiento ascendente.
      return (fa - fb) || desempate(a, b);
    case "proxima_cohorte":
      // Por creación ascendente.
      return (fa - fb) || desempate(a, b);
    case "vencidos":
      // El vencido más antiguo primero (fecha ascendente).
      return (fa - fb) || desempate(a, b);
    case "calendly":
      // La novedad más reciente primero (descendente).
      return (fb - fa) || desempate(a, b);
    case "nuevos":
      // Por creación descendente.
      return (fb - fa) || desempate(a, b);
    case "duplicados":
      // El envío más reciente primero (descendente).
      return (fb - fa) || desempate(a, b);
  }
}

/** Un valor numérico comparable de una fecha clave; `null` va al final (infinito). */
function valorDeFecha(f: Date | string | null): number {
  if (f == null) return Number.POSITIVE_INFINITY;
  if (f instanceof Date) return f.getTime();
  // 'YYYY-MM-DD': se compara como instante del día en Bogotá para un orden estable.
  return new Date(`${f}T00:00:00-05:00`).getTime();
}

/** Desempate estable por dealId, para que el orden no dependa del azar. */
function desempate(a: TarjetaNotificacion, b: TarjetaNotificacion): number {
  return a.tarjeta.dealId < b.tarjeta.dealId ? -1 : a.tarjeta.dealId > b.tarjeta.dealId ? 1 : 0;
}

/**
 * El resultado de UN chip: su conteo total, la página pedida (24/página) y la fecha más
 * próxima para la línea de resumen. El universo y lo extra se leen una vez y se reutilizan.
 */
export async function notificacionesDeChip(
  db: Db,
  args: { programId: string; userId: string; chip: ChipNotificacion; pagina?: number },
  hoy: string = hoyEnBogota(),
): Promise<ResultadoChip> {
  const { programId, userId, chip } = args;
  const pagina = Math.max(0, args.pagina ?? 0);

  const universo = await cargarUniverso(db, programId, userId, hoy);

  // Los dos chips que preguntan a otras fuentes, acotados al universo (dueño + programa).
  const [idsCalendly, idsDuplicados] = await Promise.all([
    chip === "calendly" ? idsConNovedadCalendly(db, userId, programId) : Promise.resolve(new Set<string>()),
    chip === "duplicados" ? idsDuplicadosDeHoy(db, programId, userId, universo, hoy) : Promise.resolve(new Set<string>()),
  ]);

  const evaluadas: TarjetaNotificacion[] = [];
  for (const t of universo.tarjetas) {
    const { pasa, fechaClave } = evaluar(universo, t, chip, idsCalendly, idsDuplicados);
    if (pasa) evaluadas.push({ tarjeta: t, fechaClave });
  }
  evaluadas.sort((a, b) => compararPorChip(chip, a, b));

  const total = evaluadas.length;
  const desde = pagina * POR_PAGINA;
  const tarjetas = evaluadas.slice(desde, desde + POR_PAGINA).map((e) => e.tarjeta);
  const proxima = chipConFecha(chip) && evaluadas.length > 0 ? evaluadas[0].fechaClave : null;

  return { chip, total, tarjetas, proxima };
}

/** Los conteos de TODOS los chips, para pintarlos con su número. Una sola carga del universo. */
export async function conteosDeChips(
  db: Db,
  args: { programId: string; userId: string },
  hoy: string = hoyEnBogota(),
): Promise<Record<ChipNotificacion, number>> {
  const { programId, userId } = args;
  const universo = await cargarUniverso(db, programId, userId, hoy);
  const [idsCalendly, idsDuplicados] = await Promise.all([
    idsConNovedadCalendly(db, userId, programId),
    idsDuplicadosDeHoy(db, programId, userId, universo, hoy),
  ]);

  const conteos = Object.fromEntries(
    CHIPS_NOTIFICACIONES.map((c) => [c, 0]),
  ) as Record<ChipNotificacion, number>;
  for (const t of universo.tarjetas) {
    for (const chip of CHIPS_NOTIFICACIONES) {
      if (evaluar(universo, t, chip, idsCalendly, idsDuplicados).pasa) conteos[chip] += 1;
    }
  }
  return conteos;
}

/** ¿El chip ordena/muestra por una fecha? (Nuevos y Próxima Cohorte no tienen fecha propia). */
function chipConFecha(chip: ChipNotificacion): boolean {
  return chip === "hoy" || chip === "reagenda" || chip === "seguimiento" || chip === "vencidos" || chip === "calendly";
}

/** Los dealId del usuario+programa con una novedad de Calendly (leída o no), del 201. */
async function idsConNovedadCalendly(db: Db, userId: string, programId: string): Promise<Set<string>> {
  const { noLeidas, leidas } = await novedadesCalendlyDeUsuario(db, { userId, programId, porGrupo: 50 });
  return new Set([...noLeidas, ...leidas].map((n) => n.dealId));
}

/**
 * Los dealId del universo cuyo lead es un posible duplicado del usuario y cuyo envío más
 * reciente es HOY (día de Bogotá). El universo ya es sólo del dueño en el programa, así que
 * mapear por leadId mantiene la frontera.
 */
async function idsDuplicadosDeHoy(
  db: Db,
  programId: string,
  userId: string,
  universo: Universo,
  hoy: string,
): Promise<Set<string>> {
  const { filas } = await posiblesDuplicadosDelPrograma(db, programId, {
    duenoUserId: userId,
    porPagina: 1000,
  });
  const leadIdsDuplicados = new Set(filas.map((f) => f.leadId));
  if (leadIdsDuplicados.size === 0) return new Set();

  // El envío más reciente de cada lead: `leads.fechaUltimaAplicacion`. Sólo los de hoy.
  const idsLista = [...leadIdsDuplicados];
  const filasLead = await db
    .select({ id: leads.id, fechaUltimaAplicacion: leads.fechaUltimaAplicacion })
    .from(leads)
    .where(inArray(leads.id, idsLista));
  const leadsDeHoy = new Set(
    filasLead
      .filter((l) => l.fechaUltimaAplicacion != null && diaDeCalendario(l.fechaUltimaAplicacion) === hoy)
      .map((l) => l.id),
  );

  const ids = new Set<string>();
  for (const t of universo.tarjetas) {
    if (leadsDeHoy.has(t.leadId)) ids.add(t.dealId);
  }
  return ids;
}
