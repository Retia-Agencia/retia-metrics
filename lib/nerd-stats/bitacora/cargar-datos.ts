import type { Db } from "@/lib/db/tipos";
import { filtroDeLaUrl, opcionesDeBitacora, paginaDeBitacora } from "@/lib/queries/bitacora";

type Busqueda = Record<string, string | string[] | undefined>;

export async function cargarDatosDeBitacora(db: Db, entrada: { busqueda: Busqueda }) {
  const filtro = filtroDeLaUrl(entrada.busqueda);
  const [pagina, opciones] = await Promise.all([paginaDeBitacora(filtro, db), opcionesDeBitacora(db)]);
  return { filtro, pagina, opciones };
}
