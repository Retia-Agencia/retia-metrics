import { and, eq, isNull } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { cohorts, objetivos, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export interface DatosConfiguracionHoy {
  programa: {
    id: string; nombre: string; slug: string; ticketUsd: string; webUrl: string | null; calendlyUrl: string | null;
    comisionPorcentaje: string | null; diasSinActividad: number; cortePagoRapidoDias: number | null; muestraMinimaConversion: number;
  };
  cohorte: null | {
    id: string; programId: string; codigo: string; metaCupos: number; metaLeadsDia: number | null; precioUsd: string;
    fechaInicioClases: string | null; fechaInicioVentas: string | null; fechaCierreVentas: string | null; estado: "futuro" | "activo" | "cerrado";
  };
  objetivo: null | { id: string; meta: number };
}

export async function leerConfiguracionDeHoy(
  programId: string,
  db: Db = dbDeLaApp,
): Promise<DatosConfiguracionHoy | null> {
  const [[programa], [cohorte]] = await Promise.all([
    db.select({
      id: programs.id, nombre: programs.nombre, slug: programs.slug, ticketUsd: programs.ticketUsd,
      webUrl: programs.webUrl, calendlyUrl: programs.calendlyUrl, comisionPorcentaje: programs.comisionPorcentaje,
      diasSinActividad: programs.diasSinActividad, cortePagoRapidoDias: programs.cortePagoRapidoDias,
      muestraMinimaConversion: programs.muestraMinimaConversion,
    }).from(programs).where(eq(programs.id, programId)).limit(1),
    db.select({
      id: cohorts.id, programId: cohorts.programId, codigo: cohorts.codigo, metaCupos: cohorts.metaCupos,
      metaLeadsDia: cohorts.metaLeadsDia, precioUsd: cohorts.precioUsd, fechaInicioClases: cohorts.fechaInicioClases,
      fechaInicioVentas: cohorts.fechaInicioVentas, fechaCierreVentas: cohorts.fechaCierreVentas, estado: cohorts.estado,
    }).from(cohorts).where(and(eq(cohorts.programId, programId), eq(cohorts.estado, "activo"))).limit(1),
  ]);
  if (!programa) return null;
  const [objetivo] = cohorte ? await db.select({ id: objetivos.id, meta: objetivos.meta })
    .from(objetivos).where(and(
      eq(objetivos.cohortId, cohorte.id), eq(objetivos.metrica, "conversion_agenda_venta"),
      isNull(objetivos.area), eq(objetivos.activo, true),
    )).limit(1) : [];
  return {
    programa: { ...programa, ticketUsd: String(programa.ticketUsd) },
    cohorte: cohorte ? { ...cohorte, precioUsd: String(cohorte.precioUsd) } : null,
    objetivo: objetivo ? { id: objetivo.id, meta: Number(objetivo.meta) } : null,
  };
}
