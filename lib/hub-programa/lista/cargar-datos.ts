import type { Db } from "@/lib/db/tipos";
import { vistaDeLista } from "@/lib/queries/vista-metrica";

export function cargarDatosDeListaDelPrograma(db: Db, entrada: Parameters<typeof vistaDeLista>[0]) {
  return vistaDeLista(entrada, db);
}
