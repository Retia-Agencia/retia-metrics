import type { Db } from "@/lib/db/tipos";
import { esRolValido, tieneAlcanceConfigurable, type Rol } from "./roles";

export async function alcanceLimitadoDe(rol: Rol, userId: string, db?: Db): Promise<boolean> {
  if (!tieneAlcanceConfigurable(rol)) return false;
  const { programasDelAlcance } = await import("@/lib/auth/alcance");
  const base = db ?? (await import("@/lib/db")).db;
  return (await programasDelAlcance(userId, base)).size > 0;
}

export async function camposDeSesionDeUsuario(
  registro: {
    id: string;
    rol: string;
    operaComoCloser: boolean;
    closerId: string | null;
  },
  db?: Db,
) {
  const rol = esRolValido(registro.rol) ? registro.rol : "closer";
  return {
    usuarioId: registro.id,
    rol,
    operaComoCloser: registro.operaComoCloser,
    closerId: registro.closerId,
    alcanceLimitado: await alcanceLimitadoDe(rol, registro.id, db),
  };
}
