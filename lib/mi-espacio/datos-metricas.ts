import type { Db } from "@/lib/db/tipos";
import { parsearPeriodoUrl } from "@/lib/periodo";
import {
  armarVistaDeMisMetricas,
  type ProgramaDeMetricas,
} from "@/lib/queries/mi-espacio-metricas";

type Busqueda = Record<string, string | string[] | undefined>;

export interface EntradaDeMetricas {
  programa: ProgramaDeMetricas;
  closerUserId: string;
  hoy: string;
  busqueda: Busqueda;
  origen: string;
}

export async function cargarDatosDeMetricas(db: Db, entrada: EntradaDeMetricas) {
  const periodo = parsearPeriodoUrl(entrada.busqueda);
  const vista = await armarVistaDeMisMetricas({ ...entrada, periodo }, db);
  return { vista };
}

export type DatosDeMetricas = Awaited<ReturnType<typeof cargarDatosDeMetricas>>;
