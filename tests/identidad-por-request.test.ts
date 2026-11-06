import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { programs, usuariosProgramasAlcance, users } from "@/lib/db/schema";

/**
 * Perf 6-nov: la identidad (`auth()`, `programasVisibles`, `sesionEfectiva`, `rolDeVista`)
 * se lee UNA vez por request, y NUNCA dentro de una server action.
 *
 * `cache` de React es un passthrough fuera del servidor; aqui se sustituye por una
 * memoria por request que el test "reinicia" con `nuevoRequest()`, que es lo que hace
 * React en produccion.
 */

let memoria = new Map<unknown, Map<string, unknown>>();
function nuevoRequest() {
  memoria = new Map();
}
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  const cache = <A extends unknown[], R>(fn: (...a: A) => R) =>
    (...args: A): R => {
      let porFn = memoria.get(fn);
      if (!porFn) memoria.set(fn, (porFn = new Map()));
      // Identidad por argumento, como `cache` real: objetos por referencia, primitivos por valor.
      const clave = args.map((a) => (typeof a === "object" && a !== null ? objetoId(a) : String(a))).join("|");
      if (!porFn.has(clave)) porFn.set(clave, fn(...args));
      return porFn.get(clave) as R;
    };
  return { ...original, default: { ...original, cache }, cache };
});
const ids = new WeakMap<object, number>();
let seq = 0;
function objetoId(o: object): string {
  if (!ids.has(o)) ids.set(o, ++seq);
  return `#${ids.get(o)}`;
}

let esAccion = false;
let cookieVista: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n === "next-action" && esAccion ? "abc" : null) }),
  cookies: async () => ({
    get: (n: string) => (n === "vista" && cookieVista ? { name: n, value: cookieVista } : undefined),
  }),
}));

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let consultas = 0;
let baseReal: Awaited<ReturnType<typeof crearBaseReutilizable>>;
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get: (_, prop) => {
      if (prop === "select") consultas++;
      const v = Reflect.get(baseReal.db, prop);
      return typeof v === "function" ? v.bind(baseReal.db) : v;
    },
  }),
}));

let programaId: string;
let gerenteId: string;

function sesion(over: Partial<Session["user"]> = {}): Session {
  return {
    expires: "2999-01-01",
    user: { id: gerenteId, rol: "gerente", operaComoCloser: false, closerId: null, alcanceLimitado: false, ...over },
  } as Session;
}

beforeAll(async () => {
  baseReal = await crearBaseReutilizable();
});
afterAll(async () => baseReal.cerrar());
beforeEach(async () => {
  await baseReal.vaciar();
  nuevoRequest();
  esAccion = false;
  cookieVista = undefined;
  consultas = 0;
  auth.mockReset();
  const [p] = await baseReal.db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programaId = p.id;
  const [g] = await baseReal.db.insert(users).values({ email: "g@retia.co", rol: "gerente" }).returning();
  gerenteId = g.id;
  auth.mockResolvedValue(sesion());
});

describe("identidad por request", () => {
  it("dentro de un render, auth() y programasVisibles se leen una sola vez", async () => {
    const { paginaConSesion, paginaConRol } = await import("@/lib/auth/page-guards");
    const { requireSesionReal } = await import("@/lib/auth/guards");
    const { programasVisibles, programaVisiblePorSlug } = await import("@/lib/auth/alcance");

    const s = await paginaConSesion(); // layout
    await requireSesionReal(); // layout
    await paginaConRol("gerente"); // pagina
    await programasVisibles(s.user.id, "gerente");
    await programasVisibles(s.user.id, "gerente");
    expect((await programaVisiblePorSlug(s.user.id, "gerente", "p"))?.id).toBe(programaId);

    expect(auth).toHaveBeenCalledTimes(1);
    expect(consultas).toBe(2); // alcance + programas activos: una sola resolucion para el gerente
  });

  it("(a) dentro de una server action no hay memoria: la lectura posterior a la escritura ve el dato nuevo", async () => {
    esAccion = true;
    const { programasVisibles } = await import("@/lib/auth/alcance");
    const [otro] = await baseReal.db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" }).returning();
    expect((await programasVisibles(gerenteId, "gerente")).map((x) => x.slug)).toEqual(["p", "q"]);
    // La accion acota el alcance del gerente y relee en el mismo request.
    await baseReal.db.insert(usuariosProgramasAlcance).values({ userId: gerenteId, programId: otro.id });
    expect((await programasVisibles(gerenteId, "gerente")).map((x) => x.slug)).toEqual(["q"]);
  });

  it("(a) auth() tampoco se memoiza en una server action (revalidarToken corre cada vez)", async () => {
    esAccion = true;
    const { requireSesionReal } = await import("@/lib/auth/guards");
    await requireSesionReal();
    await requireSesionReal();
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("un request nuevo vuelve a leer (quitar a alguien surte efecto en el siguiente request)", async () => {
    const { requireSesionReal } = await import("@/lib/auth/guards");
    await requireSesionReal();
    nuevoRequest();
    await requireSesionReal();
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("(b) la reja de solo lectura sigue: suplantando, una server action de escritura se rechaza", async () => {
    const [closer] = await baseReal.db.insert(users).values({ email: "c@retia.co", rol: "closer", closerId: "C" }).returning();
    auth.mockResolvedValue(sesion({ rol: "developer" }));
    cookieVista = `usuario:${closer.id}`;
    const { requireSession } = await import("@/lib/auth/guards");
    // Render (GET): lee como el closer.
    expect((await requireSession()).user.id).toBe(closer.id);
    // Server action: misma sesion, escritura => rechazada.
    nuevoRequest();
    esAccion = true;
    await expect(requireSession()).rejects.toThrow(/solo lectura/);
  });

  it("rolDeVista se memoiza por sesion en render y se calcula directo en una accion", async () => {
    auth.mockResolvedValue(sesion({ rol: "developer" }));
    const { rolDeVista } = await import("@/lib/auth/vista");
    const s = sesion({ rol: "developer" });
    cookieVista = "closer";
    expect(await rolDeVista(s)).toBe("closer");
    cookieVista = "gerente"; // cambia la cookie a mitad de request
    expect(await rolDeVista(s)).toBe("closer"); // memoizado en render
    esAccion = true;
    expect(await rolDeVista(s)).toBe("gerente"); // accion: directo
  });
});
