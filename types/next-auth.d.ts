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
      /**
       * Presente SOLO cuando un developer está suplantando a un closer ("ver como",
       * ticket 172): el id y el nombre del developer REAL detrás de la vista. Las
       * guardas la ponen al resolver la sesión efectiva; la barra fija de solo lectura
       * y la reja de escritura la leen.
       */
      suplantadoPor?: { id: string; nombre: string };
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
