import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { esRolValido } from "./roles";

/**
 * Configuracion apta para el runtime edge: sin acceso a base de datos.
 * El proxy la usa para leer el JWT; el servidor la extiende en ./index.ts.
 */
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /** Mapea los claims del token a la sesion. Puro, sin DB. */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.usuarioId ?? "";
        session.user.rol = esRolValido(token.rol) ? token.rol : "closer";
        session.user.closerId = token.closerId ?? null;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
