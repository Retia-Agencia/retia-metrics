import { eq } from "drizzle-orm";
import type { JWT } from "@auth/core/jwt";
import { esRolValido } from "./roles";

/**
 * Las dos decisiones de Auth.js que dependen de la tabla `users`, sacadas de la
 * llamada a `NextAuth({...})` para poder MORDERLAS con un test (S-02).
 *
 * Vivian como callbacks anonimos dentro de la configuracion, y eso las volvia
 * inalcanzables: el handoff las daba por "no testeables sin extraerlas de Auth.js"
 * desde el 6 de septiembre, asi que la garantia de que quitar a alguien lo saca de
 * inmediato era una CREENCIA, no un contrato probado. Esto no cambia ni una regla:
 * mueve el mismo codigo a una funcion con nombre y le pone tests.
 *
 * Lo que sigue sin cubrir un test, y hay que decirlo: que Auth.js LLAME a `jwt` en
 * cada emision de token. Eso es conducta documentada de la estrategia `jwt` y solo
 * un recorrido real con sesion abierta lo comprueba.
 */

/** Busca al usuario por correo. Import dinamico: mantiene el driver de Postgres fuera del bundle edge del proxy. */
async function buscarUsuario(email: string) {
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  const filas = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return filas[0] ?? null;
}

/**
 * Allowlist estricta, sin auto-registro: quien no este en `users` con `activo=true`
 * no entra aunque su cuenta de Google sea perfectamente valida.
 */
export async function puedeIniciarSesion(email: string | null | undefined): Promise<boolean> {
  const normalizado = email?.toLowerCase().trim();
  if (!normalizado) return false;
  const registro = await buscarUsuario(normalizado);
  return Boolean(registro && registro.activo);
}

/**
 * Revalida el token contra la base en CADA emision, no solo al iniciar sesion. Es lo
 * que hace que `npm run usuarios -- quitar` surta efecto en el siguiente request en
 * vez de esperar a que expire el JWT.
 *
 * Costo: una consulta por indice unico sobre una tabla de menos de diez filas, por
 * request que llame a `auth()`. A este tamano de equipo es despreciable.
 *
 * ponytail: si el equipo crece, el paso siguiente es `sessionVersion int` en `users`,
 * metido en el token y comparado en el callback `session`, que revoca sin consultar
 * en cada refresco.
 */
export async function revalidarToken(token: JWT, emailDelLogin?: string | null): Promise<JWT> {
  const email = (emailDelLogin ?? token.email)?.toLowerCase().trim();
  if (!email) return token;

  const registro = await buscarUsuario(email);
  if (!registro || !registro.activo) {
    // Desactivado despues de haber iniciado sesion: se vacia el token. No se borra el
    // token entero porque Auth.js necesita la envoltura; lo que se va es TODO lo que
    // una guarda podria leer para dejar pasar a alguien.
    return { ...token, usuarioId: undefined, rol: undefined, closerId: undefined };
  }

  token.usuarioId = registro.id;
  token.rol = esRolValido(registro.rol) ? registro.rol : "closer";
  token.closerId = registro.closerId;
  return token;
}
