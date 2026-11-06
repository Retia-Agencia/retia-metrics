import type { Session } from "next-auth";
import { eq } from "drizzle-orm";
import { camposDeSesionDeUsuario } from "@/lib/auth/campos-de-sesion";
import { esAccesoTotal } from "@/lib/auth/roles";
import { rolDeVistaConValor, sesionEfectivaConVista } from "@/lib/auth/vista";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { McpScope } from "./token";

export async function sesionDeToken(
  db: Db,
  entrada: { userId: string; scope: McpScope; vista?: string },
) {
  const [usuario] = await db
    .select({
      id: users.id,
      rol: users.rol,
      operaComoCloser: users.operaComoCloser,
      closerId: users.closerId,
      nombre: users.nombre,
      email: users.email,
      activo: users.activo,
    })
    .from(users)
    .where(eq(users.id, entrada.userId))
    .limit(1);
  if (!usuario?.activo) throw new ErrorDeApp("La sesión ya no está activa.", 401);

  const campos = await camposDeSesionDeUsuario(usuario, db);
  if (entrada.vista !== undefined && !esAccesoTotal(campos.rol)) {
    throw new ErrorDeApp("No puedes ver como otra persona.", 400);
  }

  const real: Session = {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: campos.usuarioId,
      rol: campos.rol,
      operaComoCloser: campos.operaComoCloser,
      closerId: campos.closerId,
      alcanceLimitado: campos.alcanceLimitado,
      name: usuario.nombre ?? usuario.email,
      email: usuario.email,
      image: null,
    },
  };

  const session = await sesionEfectivaConVista(real, entrada.vista, db);
  // Tras una suplantacion, la sesión efectiva ya trae el rol de la persona. Para una
  // vista de rol, se proyecta desde la sesión real.
  const rol = session.user.suplantadoPor
    ? await rolDeVistaConValor(session, undefined)
    : await rolDeVistaConValor(real, entrada.vista);
  return {
    session,
    rol,
    escritura: entrada.scope === "escritura" && !session.user.suplantadoPor,
  };
}
