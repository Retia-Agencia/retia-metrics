import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { esRolValido } from "./roles";

/**
 * Configuracion apta para el runtime edge: sin acceso a base de datos.
 * El proxy la usa para leer el JWT; el servidor la extiende en ./index.ts.
 */
export const authConfig = {
  providers: [Google],
  // 8 horas = una jornada. Sin maxAge rige el default de Auth.js, que son 30 dias:
  // desactivar a alguien no lo sacaba de la app durante un mes.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /** Mapea los claims del token a la sesion. Puro, sin DB. */
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.usuarioId ?? "";
        // Un token sin rol NO es un closer: es nadie. La app no tiene herencia de
        // roles, y un rol ausente no puede degradar al rol menor. Antes esto
        // traducia un token vaciado a "closer" y la app quedaba segura solo por
        // el `id` vacio, no por el rol.
        session.user.rol = esRolValido(token.rol) ? token.rol : null;
        session.user.closerId = token.closerId ?? null;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
