import type { DefaultSession } from "next-auth";
import type { Rol } from "@/lib/auth/roles";

/**
 * El rol NO se re-declara aca. Era un union escrito a mano que se desincronizo con
 * `ROLES` en cuanto entro `developer` (ticket 024): la sesion y el token seguian
 * creyendo que solo habia dos roles. Una sola definicion por pregunta (ADR 0024).
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol | null;
      closerId: string | null;
    } & DefaultSession["user"];
  }
}

/**
 * Ojo: `next-auth/jwt` solo re-exporta `@auth/core/jwt`, y augmentar un modulo que
 * re-exporta no toca la interfaz original. Hay que augmentar el modulo de origen.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    usuarioId?: string;
    rol?: Rol;
    closerId?: string | null;
  }
}
