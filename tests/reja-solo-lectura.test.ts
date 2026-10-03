import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 172 — la reja de SOLO LECTURA de la suplantación ("ver como"), en UN solo lugar:
 * `requireSession`. Una server action (que Next marca con la cabecera `next-action`) se
 * rechaza con 403 y el mensaje "Estás viendo como {nombre}: solo lectura" mientras la
 * vista suplanta a un closer. Las lecturas (sin `next-action`) pasan. `cambiarVista`
 * puede SALIR aunque la vista esté suplantando, porque usa `requireSesionReal`.
 *
 * `auth` se mockea (sesión del developer real); la base es PGlite para que `sesionEfectiva`
 * valide el closer de verdad. `next/headers` se mockea con una cookie y una cabecera
 * controlables.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let cookieVista: string | undefined;
let nextAction: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieVista !== undefined ? { name: nombre, value: cookieVista } : undefined,
    set: vi.fn(),
  }),
  headers: async () => ({
    get: (nombre: string) => (nombre === "next-action" ? (nextAction ?? null) : null),
  }),
}));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

describe("reja de solo lectura al suplantar (ticket 172)", () => {
  let base: BaseDePrueba;
  let developerId: string;
  let closerId: string;

  beforeAll(async () => {
    base = await crearBaseDePrueba();
    db = base.db;
  }, 60_000);
  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    auth.mockReset();
    cookieVista = undefined;
    nextAction = undefined;
    await db.delete(users);
    const [dev] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev Real" })
      .returning();
    developerId = dev.id;
    const [c] = await db
      .insert(users)
      .values({ email: "nico@retiagrowth.com", rol: "closer", nombre: "Nicolás", closerId: "Nico" })
      .returning();
    closerId = c.id;
    auth.mockResolvedValue({
      user: { id: developerId, rol: "developer", closerId: null, name: "Dev Real", email: "dev@retiagrowth.com" },
    });
  });
  afterEach(() => {
    cookieVista = undefined;
    nextAction = undefined;
  });

  it("una ESCRITURA (cabecera next-action) bajo suplantación lanza 403 con el mensaje de solo lectura", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada"; // Next marca así una server action.
    const { requireSession } = await import("@/lib/auth/guards");
    await expect(requireSession()).rejects.toMatchObject({
      status: 403,
      message: "Estás viendo como Nicolás: solo lectura.",
    });
  });

  it("una LECTURA (sin next-action) bajo suplantación pasa con la sesión del closer", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = undefined;
    const { requireSession } = await import("@/lib/auth/guards");
    const session = await requireSession();
    expect(session.user.id).toBe(closerId);
    expect(session.user.rol).toBe("closer");
    expect(session.user.suplantadoPor).toMatchObject({ id: developerId });
  });

  it("bajo suplantación con next-action: la guarda de LECTURA pasa y la de ESCRITURA (requireRole) da 403", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada"; // una server action forjada, como la que arma moverDeal
    const { requireRole, requireRoleDeLectura } = await import("@/lib/auth/guards");

    // La guarda de lectura (revisarMovimiento, buscarDealsAbiertos) pasa con la sesión del closer.
    const lectura = await requireRoleDeLectura("gerente", "closer");
    expect(lectura.user.id).toBe(closerId);
    expect(lectura.user.suplantadoPor).toMatchObject({ id: developerId });

    // La guarda de escritura (la que usa moverDeal) sigue dando el 403 de solo lectura.
    await expect(requireRole("gerente", "closer")).rejects.toMatchObject({
      status: 403,
      message: "Estás viendo como Nicolás: solo lectura.",
    });
  });

  it("sin suplantar, una escritura del developer pasa (la reja solo aplica a la vista suplantada)", async () => {
    cookieVista = undefined;
    nextAction = "accion-forjada";
    const { requireSession } = await import("@/lib/auth/guards");
    const session = await requireSession();
    expect(session.user.id).toBe(developerId);
    expect(session.user.suplantadoPor).toBeUndefined();
  });

  it("requireSesionReal ignora la suplantación: devuelve al developer real (así 'Salir' funciona)", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada";
    const { requireSesionReal } = await import("@/lib/auth/guards");
    const session = await requireSesionReal();
    expect(session.user.id).toBe(developerId);
    expect(session.user.rol).toBe("developer");
    expect(session.user.suplantadoPor).toBeUndefined();
  });

  it("cambiarVista('todo') funciona aunque la vista esté suplantando (sale de la vista)", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada";
    const { cambiarVista } = await import("@/app/(app)/acciones-vista");
    // No lanza: usa el rol REAL (developer) y escribe la cookie.
    await expect(cambiarVista("todo")).resolves.toBeUndefined();
  });
});

/**
 * Ticket 177 — la guarda de SOLO LECTURA (`requireRoleDeLectura` / `requireSessionDeLectura`):
 * una server action que solo LEE puede correr bajo suplantación. La lista de las que la usan
 * ES la excepción (`ACCIONES_DE_SOLO_LECTURA`), y este guardián falla si una server action usa
 * la guarda de lectura sin estar nombrada. Molde de barrido como `TABLAS_PUENTE_BORRABLES`.
 */
describe("ACCIONES_DE_SOLO_LECTURA: la lista es la excepción (ticket 177)", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const GUARDAS = ["requireRoleDeLectura", "requireSessionDeLectura"];

  function archivosDe(dir: string): string[] {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) return [];
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(abs, { withFileTypes: true })) {
      const ruta = path.join(abs, entrada.name);
      if (entrada.isDirectory()) salida.push(...archivosDe(path.join(dir, entrada.name)));
      else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) salida.push(ruta);
    }
    return salida;
  }

  /** Las server actions exportadas de un archivo que, en su cuerpo, usan la guarda de lectura. */
  function accionesConGuardaDeLectura(fuente: string): string[] {
    if (!GUARDAS.some((g) => fuente.includes(g))) return [];
    const encontradas: string[] = [];
    // Corta por cada export de función y mira si su cuerpo (hasta el próximo export) usa la guarda.
    const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)/g;
    const marcas: { nombre: string; indice: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) marcas.push({ nombre: m[1], indice: m.index });
    for (let i = 0; i < marcas.length; i++) {
      const inicio = marcas[i].indice;
      const fin = i + 1 < marcas.length ? marcas[i + 1].indice : fuente.length;
      const cuerpo = fuente.slice(inicio, fin);
      if (GUARDAS.some((g) => cuerpo.includes(`${g}(`))) encontradas.push(marcas[i].nombre);
    }
    return encontradas;
  }

  it("ninguna server action usa la guarda de lectura sin estar en la lista", async () => {
    const { ACCIONES_DE_SOLO_LECTURA } = await import("@/lib/auth/guards");
    const permitidas = new Set<string>(ACCIONES_DE_SOLO_LECTURA);
    const sinNombrar: string[] = [];
    for (const archivo of archivosDe("app")) {
      const fuente = fs.readFileSync(archivo, "utf8");
      for (const accion of accionesConGuardaDeLectura(fuente)) {
        if (!permitidas.has(accion)) sinNombrar.push(`${path.relative(RAIZ, archivo)} → ${accion}`);
      }
    }
    expect(sinNombrar).toEqual([]);
  });

  it("el guardián NO es trivial: una acción nueva con la guarda, sin nombrar, se caza", () => {
    const fuente = `
      import { requireRoleDeLectura } from "@/lib/auth/guards";
      export async function accionNuevaForjada() {
        await requireRoleDeLectura("gerente", "closer");
        return { ok: true };
      }
    `;
    const detectadas = accionesConGuardaDeLectura(fuente);
    expect(detectadas).toContain("accionNuevaForjada");
    // Y como no está en la lista real, el guardián de arriba fallaría por ella.
    const permitidas = new Set<string>(["revisarMovimientoAccion", "buscarDealsAbiertosAccion"]);
    expect(detectadas.some((a) => !permitidas.has(a))).toBe(true);
  });

  it("las dos acciones nombradas existen y están en la lista", async () => {
    const { ACCIONES_DE_SOLO_LECTURA } = await import("@/lib/auth/guards");
    expect(ACCIONES_DE_SOLO_LECTURA).toContain("revisarMovimientoAccion");
    expect(ACCIONES_DE_SOLO_LECTURA).toContain("buscarDealsAbiertosAccion");
  });
});
