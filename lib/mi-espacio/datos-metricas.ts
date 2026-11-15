import type { Db } from "@/lib/db/tipos";
import { parsearPeriodoUrl } from "@/lib/periodo";
import {
  armarVistaDeMisMetricas,
  armarVistaDeMisMetricasTodos,
  type ProgramaDeMetricas,
} from "@/lib/queries/mi-espacio-metricas";

type Busqueda = Record<string, string | string[] | undefined>;

export interface EntradaDeMetricas {
  programas: ProgramaDeMetricas[];
  programa: ProgramaDeMetricas | null;
  closerUserId: string;
  hoy: string;
  busqueda: Busqueda;
  origen: string;
}

export async function cargarDatosDeMetricas(db: Db, entrada: EntradaDeMetricas) {
  const periodo = parsearPeriodoUrl(entrada.busqueda);
  if (entrada.programa) {
    const vista = await armarVistaDeMisMetricas({ ...entrada, programa: entrada.programa, periodo }, db);
    return { tipo: "programa" as const, vista };
  }
  const todos = await armarVistaDeMisMetricasTodos({ ...entrada, periodo }, db);
  return { tipo: "todos" as const, todos };
}

export type DatosDeMetricas = Awaited<ReturnType<typeof cargarDatosDeMetricas>>;
