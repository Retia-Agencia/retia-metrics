import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket 069, parte A: el login LOCAL solo existe con `AUTH_LOGIN_LOCAL=1` Y una
 * `DATABASE_URL` que apunta a una base local. En produccion (sin el flag, o con el flag
 * pero contra una URL de Supabase) el proveedor no se registra, asi que la app es
 * byte-identica a la de siempre. `authorize` acepta un correo y lo devuelve; la base
 * decide si entra (via `puedeIniciarSesion`/`revalidarToken`), no este proveedor.
 */

const URL_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54329/retia_local";
const URL_SUPABASE = "postgresql://postgres.hfqmiyiuyqapdsbywrag:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

const FLAG_PREVIO = process.env.AUTH_LOGIN_LOCAL;
const URL_PREVIA = process.env.DATABASE_URL;

async function cargar() {
  // Re-import limpio para que cada caso lea el entorno actual (los helpers son puros y
  // leen `process.env` en cada llamada, pero reseteamos por claridad).
  vi.resetModules();
  return import("@/lib/auth/login-local");
}

beforeEach(() => {
  delete process.env.AUTH_LOGIN_LOCAL;
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (FLAG_PREVIO === undefined) delete process.env.AUTH_LOGIN_LOCAL;
  else process.env.AUTH_LOGIN_LOCAL = FLAG_PREVIO;
  if (URL_PREVIA === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = URL_PREVIA;
});

describe("proveedor de login local", () => {
  it("SIN el flag no existe, aunque la URL sea local", async () => {
    process.env.DATABASE_URL = URL_LOCAL;
    const { loginLocalHabilitado, proveedorLoginLocal } = await cargar();
    expect(loginLocalHabilitado()).toBe(false);
    expect(proveedorLoginLocal()).toBeNull();
  });

  it("CON el flag pero una URL NO local (pooler de Supabase) no existe", async () => {
    process.env.AUTH_LOGIN_LOCAL = "1";
    process.env.DATABASE_URL = URL_SUPABASE;
    const { loginLocalHabilitado, proveedorLoginLocal } = await cargar();
    expect(loginLocalHabilitado()).toBe(false);
    expect(proveedorLoginLocal()).toBeNull();
  });

  it("CON el flag y una URL local, existe", async () => {
    process.env.AUTH_LOGIN_LOCAL = "1";
    process.env.DATABASE_URL = URL_LOCAL;
    const { loginLocalHabilitado, proveedorLoginLocal, LOGIN_LOCAL_ID } = await cargar();
    expect(loginLocalHabilitado()).toBe(true);
    const proveedor = proveedorLoginLocal();
    expect(proveedor).not.toBeNull();
    // El id configurado (el que usa el boton de /login) vive en `options.id`: Auth.js
    // deja `id` en "credentials" y guarda lo que pasamos en `options`.
    const opciones = (proveedor as { options?: { id?: string } }).options;
    expect(opciones?.id).toBe(LOGIN_LOCAL_ID);
  });

  it("authorize devuelve el correo normalizado y rechaza uno vacio", async () => {
    process.env.AUTH_LOGIN_LOCAL = "1";
    process.env.DATABASE_URL = URL_LOCAL;
    const { proveedorLoginLocal } = await cargar();
    const opciones = (proveedorLoginLocal() as unknown as {
      options: { authorize: (c: Record<string, unknown> | undefined) => unknown };
    }).options;

    expect(opciones.authorize({ email: "  DEV@Retia.Local " })).toEqual({ email: "dev@retia.local" });
    // El rol y el closerId NO los pone authorize: los pone la base en el callback jwt.
    expect(opciones.authorize({ email: "" })).toBeNull();
    expect(opciones.authorize({})).toBeNull();
    expect(opciones.authorize(undefined)).toBeNull();
  });
});
