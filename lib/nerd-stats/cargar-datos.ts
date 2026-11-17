import type { Db } from "@/lib/db/tipos";
import { conteosPorOrigen, conteosPorPrograma, fuentesConSalud, ultimosCambiosDesdeLaApp, usuariosActivosPorRol } from "@/lib/queries/nerd-stats";

export async function cargarDatosDeNerdStats(db: Db) {
  const [programas, fuentes, origenes, cambios, roles] = await Promise.all([
    conteosPorPrograma(db), fuentesConSalud(db), conteosPorOrigen(db), ultimosCambiosDesdeLaApp(15, db), usuariosActivosPorRol(db),
  ]);
  return { programas, fuentes, origenes, cambios, roles };
}
