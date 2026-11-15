import { enviosPorCanal } from "@/lib/atribucion/envios-por-canal";
import type { Db } from "@/lib/db/tipos";

export async function cargarDatosDeCanales(db: Db) {
  return enviosPorCanal(db);
}

export type DatosDeCanales = Awaited<ReturnType<typeof cargarDatosDeCanales>>;
