import type { Rol } from "@/lib/auth/roles";
import { programasVisibles } from "@/lib/auth/alcance";
import type { Db } from "@/lib/db/tipos";

export function cargarDatosDeRedireccionARecursos(db: Db, entrada: { userId: string; rol: Rol | null }) {
  return programasVisibles(entrada.userId, entrada.rol, db);
}
