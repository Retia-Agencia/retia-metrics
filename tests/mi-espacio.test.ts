import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ticket 172 — la página `/mi-espacio`: selector de programa obligatorio (frontera), un
 * programa ajeno es 404, y sin membresías se ve el mensaje en vez de una pantalla vacía.
 *
 * Se invoca el componente real. La página devuelve JSX de forma perezosa, así que las
 * tabs (que leen la base) NO se ejecutan al correr la página: solo se crean los
 * elementos. Por eso basta con mockear las lecturas de la propia página —el alcance, las
 * membresías y el Calendly— y afirmar la rama (404 / mensaje / render).
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let cookieVista: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieVista !== undefined ? { name: nombre, value: cookieVista } : undefined,
  }),
}));

const notFound = vi.fn(() => {
  throw new NoEncontrado();
});
const redirect = vi.fn((destino: string) => {
  throw new Redireccion(destino);
});
vi.mock("next/navigation", () => ({ notFound, redirect }));

class NoEncontrado extends Error {}
class Redireccion extends Error {
  constructor(readonly destino: string) {
    super(destino);
  }
}

vi.mock("@/lib/db", () => ({ db: {} }));

const programasVisibles = vi.fn();
const programaVisiblePorSlug = vi.fn();
vi.mock("@/lib/auth/alcance", () => ({ programasVisibles, programaVisiblePorSlug }));

const membresiasConCalendlyDe = vi.fn();
vi.mock("@/lib/catalogo/usuarios", () => ({ membresiasConCalendlyDe }));

const cuentasPorPrograma = vi.fn();
vi.mock("@/lib/calendly/cuentas", () => ({ cuentasPorPrograma }));

const programasActivos = vi.fn();
vi.mock("@/lib/queries/programas", () => ({ programasActivos }));

const PROG_A = { id: "p-a", slug: "programa-a", nombre: "Programa A" };
const PROG_B = { id: "p-b", slug: "programa-b", nombre: "Programa B" };

const sesionCloser = {
  user: { id: "u-closer", rol: "closer", closerId: "Nico", name: "Nicolás", email: "nico@x.co", image: null },
};

async function correr(busqueda: Record<string, string> = {}): Promise<"render" | "notFound" | "login"> {
  const modulo = (await import("@/app/(app)/mi-espacio/page")) as {
    default: (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<unknown>;
  };
  try {
    await modulo.default({ searchParams: Promise.resolve(busqueda) });
    return "render";
  } catch (e) {
    if (e instanceof NoEncontrado) return "notFound";
    if (e instanceof Redireccion) return e.destino === "/login" ? "login" : "render";
    throw e;
  }
}

describe("/mi-espacio (ticket 172)", () => {
  beforeEach(() => {
    auth.mockReset();
    cookieVista = undefined;
    notFound.mockClear();
    programasVisibles.mockReset();
    programaVisiblePorSlug.mockReset();
    membresiasConCalendlyDe.mockReset();
    cuentasPorPrograma.mockReset();
    cuentasPorPrograma.mockResolvedValue({});
    programasActivos.mockReset();
    programasActivos.mockResolvedValue([PROG_A, PROG_B]);
    auth.mockResolvedValue(sesionCloser);
  });

  it("sin membresías NO llama a notFound y renderiza (el mensaje de A-04)", async () => {
    membresiasConCalendlyDe.mockResolvedValue([]);
    expect(await correr()).toBe("render");
    expect(notFound).not.toHaveBeenCalled();
    // No resuelve el selector de programa: no hay programa que mostrar.
    expect(programaVisiblePorSlug).not.toHaveBeenCalled();
  });

  it("un closer con dos programas, sin ?programa, aterriza en el primero visible", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
      { id: "m-b", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-b", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A, PROG_B]);
    expect(await correr()).toBe("render");
    expect(notFound).not.toHaveBeenCalled();
    // Sin ?programa toma el primero visible, no resuelve por slug.
    expect(programaVisiblePorSlug).not.toHaveBeenCalled();
  });

  it("un ?programa visible se resuelve por slug y renderiza", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A, PROG_B]);
    programaVisiblePorSlug.mockResolvedValue(PROG_B);
    expect(await correr({ programa: "programa-b" })).toBe("render");
    expect(programaVisiblePorSlug).toHaveBeenCalledWith("u-closer", "closer", "programa-b");
  });

  it("un programa AJENO (o inexistente) en la URL es 404", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A]);
    programaVisiblePorSlug.mockResolvedValue(null); // ajeno: fuera del alcance
    expect(await correr({ programa: "programa-ajeno" })).toBe("notFound");
  });

  it("sin sesión manda al login (conserva la guarda de quien trabaja leads)", async () => {
    auth.mockResolvedValue(null);
    expect(await correr()).toBe("login");
  });
});
