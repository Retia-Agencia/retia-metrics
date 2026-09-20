import NextAuth from "next-auth";
import { authConfig } from "./config";
import { puedeIniciarSesion, revalidarToken } from "./revalidacion";

/**
 * Instancia completa de Auth.js. Corre en runtime Node (tiene acceso a la base de datos).
 * El allowlist vive en la tabla `users`: quien no este ahi con activo=true, no entra.
 *
 * Las dos decisiones que consultan la base viven en `./revalidacion` y no aqui, para
 * que se puedan probar (S-02). Ver la nota de ese archivo.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    /** Devolver false hace que Auth.js redirija a /login?error=AccessDenied (403 en la API). */
    async signIn({ user }) {
      return puedeIniciarSesion(user.email);
    },

    async jwt({ token, user }) {
      return revalidarToken(token, user?.email);
    },
  },
});
