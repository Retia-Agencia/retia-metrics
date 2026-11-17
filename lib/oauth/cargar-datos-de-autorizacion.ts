import type { Db } from "@/lib/db/tipos";
import { validarPeticionDeAutorizar } from "@/lib/oauth/autorizar";

export function cargarDatosDeAutorizacion(db: Db, entrada: { params: Record<string, string | undefined> }) {
  return validarPeticionDeAutorizar(db, entrada.params);
}
