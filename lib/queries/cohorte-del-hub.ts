import { and, desc, eq, min, sql } from "drizzle-orm";
import { z } from "zod";
import { cohorts, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { diaDeCalendario } from "@/lib/dias-habiles";
import type { CohorteVieja } from "@/lib/periodo";
import { ventanasAnterioresDeCohorte } from "@/lib/queries/ventanas-de-cohortes";
import { ventasDelFiltro } from "@/lib/queries/ventas-de-la-cohorte";
import { columnasCohorteConEstado, type EstadoCohorte } from "@/lib/cohortes/estado";
import { hoyEnBogota } from "@/lib/format";

/**
 * El filtro de COHORTE del Hub (377, G-1): independiente del periodo. `?cohorte=<id>` elige una,
 * `?cohorte=todas` toda la vida del programa; sin él rige la activa (DH-1). Un id que no es de ESTE
 * programa se ignora y no filtra (el programa es frontera, como el de closer). Es la UNICA respuesta a
 * "¿qué cohorte mira el Hub?": la página, la lista detrás de cada cifra y el recorrido de enlaces
 * viejos la importan de aquí.
 */
export const TODAS_LAS_COHORTES = "todas";

const idDeCohorte = z.string().uuid();

/** Lo que dice la URL, validado en el borde: `todas`, un uuid o nada. Cualquier otra cosa es nada. */
export function cohorteDeLaUrl(valor: unknown): string | undefined {
  if (valor === TODAS_LAS_COHORTES) return TODAS_LAS_COHORTES;
  const id = idDeCohorte.safeParse(valor);
  return id.success ? id.data : undefined;
}

export interface OpcionDeCohorte {
  id: string;
  codigo: string;
  activa: boolean;
}

type CohorteConEstado = typeof cohorts.$inferSelect & { estado: EstadoCohorte };

export interface CohorteDelHub {
  /** La elegida, o `null` con "Todas" (y en un programa sin cohortes). */
  cohorte: CohorteConEstado | null;
  /** La activa del programa: la que rige sin `?cohorte=`. */
  activa: CohorteConEstado | null;
  /** Todas las del programa, la más reciente primero: las opciones del selector. */
  opciones: OpcionDeCohorte[];
}

async function cohortesDelHub(db: Db, programId: string) {
  const hoy = hoyEnBogota();
  return unaVezPorSolicitud(db, claveDe("cohortesDelHub", programId, hoy), () => db.select(columnasCohorteConEstado(hoy)).from(cohorts)
    .where(eq(cohorts.programId, programId))
    .orderBy(desc(cohorts.fechaInicioClases), desc(cohorts.id)));
}

/** La cohorte inmediatamente anterior a `cohorte` por inicio de clases (el orden de `ventanasAnterioresDeCohorte`). */
function anteriorDe(todas: CohorteConEstado[], cohorte: CohorteConEstado): CohorteConEstado | null {
  if (!cohorte.fechaInicioClases) return null;
  const inicio = cohorte.fechaInicioClases;
  return todas
    .filter((c) => c.fechaInicioClases !== null && c.fechaInicioClases < inicio)
    .sort((a, b) => (b.fechaInicioClases! < a.fechaInicioClases! ? -1 : b.fechaInicioClases! > a.fechaInicioClases! ? 1 : b.id.localeCompare(a.id)))[0] ?? null;
}

export async function cohorteDelHub(
  db: Db,
  programId: string,
  pedido: { parametro?: string; cohorteVieja?: CohorteVieja },
): Promise<CohorteDelHub> {
  return unaVezPorSolicitud(db, claveDe("cohorteDelHub", programId, pedido), async () => {
    const todas = await cohortesDelHub(db, programId);
    const activa = todas.find((c) => c.estado === "activo") ?? null;
    const opciones = todas.map((c) => ({ id: c.id, codigo: c.codigo, activa: c.id === activa?.id }));

    if (pedido.parametro === TODAS_LAS_COHORTES) return { cohorte: null, activa, opciones };
    const elegida = pedido.parametro ? todas.find((c) => c.id === pedido.parametro) : undefined;
    if (elegida) return { cohorte: elegida, activa, opciones };
    // Un enlace viejo con "Cohorte actual/anterior" (periodo) se lee como la cohorte que pedía.
    if (pedido.cohorteVieja === "anterior" && activa) return { cohorte: anteriorDe(todas, activa), activa, opciones };
    return { cohorte: activa, activa, opciones };
  });
}

export interface ContextoDelFiltro {
  /** El día en que arranca "Desde el inicio": lo primero que pasó en la cohorte (o el programa). */
  inicio: string | null;
  /** La ventana de venta de la cohorte anterior a la elegida; `null` con "Todas". */
  anterior: { id: string; inicio: string; cierre: string } | null;
  ventas: { dealId: string; dia: string }[];
}

/**
 * El primer inicio de ventas y el primer envío del programa: no dependen de `hoy` ni del
 * periodo, así que se comparten dentro de una solicitud (Hoy los pide la vista de todos y el
 * reporte diario por programa, 447).
 */
function inicioDeLaVidaDelPrograma(db: Db, programId: string) {
  return unaVezPorSolicitud(db, claveDe("inicioDeLaVidaDelPrograma", programId), () => Promise.all([
    db.select({ inicio: min(cohorts.fechaInicioVentas) }).from(cohorts).where(eq(cohorts.programId, programId)),
    db.select({ primero: sql<Date | null>`min(${leads.fechaPrimeraAplicacion})` }).from(leads).where(and(eq(leads.programId, programId), eq(leads.entrada, "formulario"))),
  ]));
}

/**
 * "Desde el inicio" arranca en lo MÁS TEMPRANO entre el inicio de ventas de la cohorte y su primera venta
 * real: una venta anterior al inicio (C-08, medido el 3-nov) no puede quedar fuera del periodo.
 * Con "Todas", lo más temprano entre las cohortes del programa, su primera venta y su primer envío.
 */
export async function contextoDelFiltro(
  db: Db,
  programId: string,
  cohorte: typeof cohorts.$inferSelect | null,
  hoy: string,
): Promise<ContextoDelFiltro> {
  // Las consultas son independientes entre sí: arrancan juntas (un viaje a la base, no tres en serie).
  const [ventas, anterior, deLaVidaDelPrograma] = await Promise.all([
    ventasDelFiltro(db, programId, cohorte?.id ?? null, hoy),
    cohorte ? ventanasAnterioresDeCohorte(db, programId, cohorte.id).then((v) => v.anterior) : Promise.resolve(null),
    cohorte
      ? Promise.resolve(null)
      : inicioDeLaVidaDelPrograma(db, programId),
  ]);
  const primeraVenta = ventas.map((v) => v.dia).sort()[0] ?? null;
  const candidatas: (string | null)[] = [primeraVenta];
  if (cohorte) {
    candidatas.push(cohorte.fechaInicioVentas);
  } else if (deLaVidaDelPrograma) {
    const [[fila], [envio]] = deLaVidaDelPrograma;
    candidatas.push(fila?.inicio ?? null, envio?.primero ? diaDeCalendario(envio.primero) : null);
  }
  const inicio = candidatas.filter((d): d is string => d !== null).sort()[0] ?? null;
  return { inicio, anterior, ventas };
}
