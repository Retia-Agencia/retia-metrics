import NextAuth from "next-auth";
import { eq } from "drizzle-orm";
import { authConfig } from "./config";
import { esRolValido } from "./roles";

/**
 * Instancia completa de Auth.js. Corre en runtime Node (tiene acceso a la base de datos).
 * El allowlist vive en la tabla `users`: quien no este ahi con activo=true, no entra.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Allowlist estricta. Sin auto-registro.
     * Devolver false hace que Auth.js redirija a /login?error=AccessDenied (HTTP 403 en la API).
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const registro = await buscarUsuario(email);
      return Boolean(registro && registro.activo);
    },

    /**
     * Mete rol, id y closerId en el token y los revalida contra la base de datos en
     * CADA emision, no solo al iniciar sesion. Es lo que hace que `npm run usuarios
     * -- quitar` surta efecto de inmediato en vez de esperar a que expire el JWT.
     *
     * Costo: con estrategia JWT este callback corre en cada lectura de sesion del
     * lado servidor, asi que es una consulta por indice unico sobre una tabla de
     * menos de diez filas por request que llame a auth(). A este tamano de equipo es
     * despreciable. El proxy no paga nada: usa authConfig, que no toca la base.
     *
     * ponytail: si el equipo crece, el paso siguiente es `sessionVersion int` en
     * users, metido en el token y comparado en el callback `session`, que revoca sin
     * consultar en cada refresco.
     */
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email)?.toLowerCase().trim();
      if (!email) return token;

      const registro = await buscarUsuario(email);
      if (!registro || !registro.activo) {
        // Usuario desactivado despues de haber iniciado sesion: se vacia el token.
        return { ...token, usuarioId: undefined, rol: undefined, closerId: undefined };
      }
      token.usuarioId = registro.id;
      token.rol = esRolValido(registro.rol) ? registro.rol : "closer";
      token.closerId = registro.closerId;

      return token;
    },
  },
});

async function buscarUsuario(email: string) {
  // Import dinamico: mantiene el driver de Postgres fuera del bundle edge del proxy.
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  const filas = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return filas[0] ?? null;
}
