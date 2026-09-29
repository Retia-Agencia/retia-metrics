import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { esUrlLocal } from "@/lib/db/es-local";

/**
 * Login de SOLO desarrollo contra la base local de Docker (ticket 069, parte A).
 *
 * Auth.js hoy solo tiene Google, asi que nadie podia entrar a `npm run dev:local`
 * (Docker Postgres): Google no autentica un correo `.local`. Este proveedor abre esa
 * puerta, y SOLO esa: pide un correo, y las mismas guardas de siempre
 * (`puedeIniciarSesion` en `signIn`, `revalidarToken` en `jwt`) deciden si entra y con
 * que rol —igual que con Google—. Aqui no se decide rol ni permiso: solo se afirma
 * "este correo quiere entrar" y la base manda.
 *
 * 🔒 **En produccion NO existe.** Se registra unicamente si se cumplen LAS DOS cosas:
 *   1. `AUTH_LOGIN_LOCAL === "1"` (lo pone `scripts/dev-local.ts` para su hijo; Vercel
 *      nunca lo setea), y
 *   2. `DATABASE_URL` pasa el mismo check de "es local" que la guardia del script
 *      (`esUrlLocal`, la unica respuesta a esa pregunta, AGENTS.md).
 *
 * Con cualquiera de las dos en falso, `proveedorLoginLocal()` devuelve `null` y el
 * arreglo de proveedores queda byte-identico al de produccion. Las dos condiciones
 * juntas hacen que un flag encendido por error contra la base de produccion NO
 * registre nada: la base tiene que ser local ademas.
 */

/**
 * El id de ruta del proveedor de credenciales de Auth.js y del botón de `/login`.
 * Credentials conserva este id en la ruta aunque reciba opciones personalizadas.
 */
export const LOGIN_LOCAL_ID = "credentials";

/** `true` si el login local debe existir en esta ejecucion (flag + base local). */
export function loginLocalHabilitado(): boolean {
  return process.env.AUTH_LOGIN_LOCAL === "1" && esUrlLocal(process.env.DATABASE_URL ?? "");
}

/**
 * El proveedor de credenciales local, o `null` si no debe existir. `authorize` solo
 * toma un correo y lo devuelve como usuario; la validacion real (existe, esta activo,
 * su rol) corre despues en `signIn`/`jwt`, exactamente como con Google. Un correo
 * desconocido o inactivo lo rechaza `puedeIniciarSesion` (devuelve `null` -> acceso
 * denegado), no este `authorize`.
 */
export function proveedorLoginLocal(): Provider | null {
  if (!loginLocalHabilitado()) return null;
  return Credentials({
    id: LOGIN_LOCAL_ID,
    name: "Local (solo desarrollo)",
    credentials: { email: { label: "Correo", type: "email" } },
    authorize(credenciales) {
      const email = String(credenciales?.email ?? "").toLowerCase().trim();
      if (!email) return null;
      // Se devuelve el correo y nada mas: el rol y el closerId los pone la base en el
      // callback `jwt` (revalidarToken), nunca este proveedor.
      return { email };
    },
  });
}
