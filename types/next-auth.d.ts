import type { DefaultSession } from "next-auth";

type Rol = "gerente" | "closer";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rol: Rol;
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
