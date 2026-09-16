import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * B-10: los route handlers ya tenian cobertura de permisos, pero ninguna PAGINA la
 * tenia, y `paginaConRol` es lo unico que protege las rutas de administracion.
 *
 * Desde ADR 0009 (15 sep 2026), el dashboard de programa dejo de ser exclusivo de
 * gerente: un closer tambien ve ahi caja, pauta y el comparativo entre closers
 * ("todos ven todo"). Lo que sigue siendo exclusivo de gerente es la administracion
 * del sistema: `/ajustes` y `/ajustes/fuentes`.
 *
 * El dashboard vive en una ruta dinamica `/programas/[slug]` (ADR 0012): un solo
 * componente sirve a todos los programas, que salen de la base. La guarda corre
 * antes de mirar el slug, asi que sin sesion redirige a login sin filtrar que
 * slugs existen; un slug inexistente o inactivo, ya con sesion, es 404.
 *
 * Se invoca el componente de pagina real. Si alguien afloja una guarda, esto falla.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

const redirect = vi.fn();
const notFound = vi.fn();
vi.mock("next/navigation", () => ({ redirect, notFound }));

// La pagina dinamica de programa lee la base; en los tests no hay base, asi que se
// mockea la query. `programaActivoPorSlug` devuelve un programa para los slugs
// "existentes" y null para el resto, imitando "no existe o esta inactivo".
const programaActivoPorSlug = vi.fn();
const programasActivos = vi.fn();
vi.mock("@/lib/queries/programas", () => ({ programaActivoPorSlug, programasActivos }));

/** El `redirect` real interrumpe el render lanzando. El mock imita eso. */
class Redireccion extends Error {
  constructor(readonly destino: string) {
    super(`redirect a ${destino}`);
  }
}

/** `notFound()` tambien interrumpe el render lanzando; se reconoce por su clase. */
class NoEncontrado extends Error {
  constructor() {
    super("notFound");
  }
}

const sesionGerente = { user: { id: "u-1", email: "gerente@retia.co", rol: "gerente", closerId: null } };
const sesionCloser = { user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" } };

beforeEach(() => {
  auth.mockReset();
  redirect.mockReset();
  notFound.mockReset();
  programaActivoPorSlug.mockReset();
  programasActivos.mockReset();
  // Por defecto, un gerente rechazado de una pagina de closer aterriza en su primer
  // programa activo. `destinoInicial("gerente")` consulta esta lista.
  programasActivos.mockResolvedValue([{ slug: "programa-a", nombre: "Programa A" }]);
  redirect.mockImplementation((destino: string) => {
    throw new Redireccion(destino);
  });
  notFound.mockImplementation(() => {
    throw new NoEncontrado();
  });
});

/** Devuelve a donde redirigio la pagina, o null si dejo pasar. */
async function destinoDe(ruta: string): Promise<string | null> {
  const modulo = (await import(/* @vite-ignore */ ruta)) as {
    default: () => Promise<unknown>;
  };
  try {
    await modulo.default();
    return null;
  } catch (e) {
    if (e instanceof Redireccion) return e.destino;
    throw e;
  }
}

const PAGINAS_DE_GERENTE = [
  ["/ajustes", "@/app/(app)/ajustes/page"],
  ["/ajustes/fuentes", "@/app/(app)/ajustes/fuentes/page"],
] as const;

/**
 * El dashboard de programa vive en una ruta dinamica `/programas/[slug]`. Se
 * invoca el componente real con `params` como Promise (Next 16). La guarda corre
 * ANTES de mirar el slug: sin sesion redirige a login aunque el slug no exista, y
 * nunca filtra que slugs existen.
 */
const RUTA_PROGRAMA = "@/app/(app)/programas/[slug]/page";

/** Ejecuta la pagina de programa con un slug y devuelve que hizo. */
async function correrPrograma(
  slug: string,
): Promise<"paso" | "login" | "midia" | "notFound"> {
  const modulo = (await import(/* @vite-ignore */ RUTA_PROGRAMA)) as {
    default: (props: { params: Promise<{ slug: string }> }) => Promise<unknown>;
  };
  try {
    await modulo.default({ params: Promise.resolve({ slug }) });
    return "paso";
  } catch (e) {
    if (e instanceof NoEncontrado) return "notFound";
    if (e instanceof Redireccion) return e.destino === "/login" ? "login" : "midia";
    throw e;
  }
}

describe("paginas de gerente", () => {
  for (const [nombre, ruta] of PAGINAS_DE_GERENTE) {
    it(`${nombre} rechaza a un closer y lo manda a su vista`, async () => {
      auth.mockResolvedValue(sesionCloser);
      expect(await destinoDe(ruta)).toBe("/mi-dia");
    });

    it(`${nombre} manda al login a quien no tiene sesion`, async () => {
      auth.mockResolvedValue(null);
      expect(await destinoDe(ruta)).toBe("/login");
    });
  }
});

describe("dashboard de programa /programas/[slug] (ADR 0009 + 0012)", () => {
  const SLUG_EXISTE = "programa-a";
  const SLUG_NO_EXISTE = "no-existe";

  it("deja pasar a un gerente con un slug existente", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaActivoPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("paso");
  });

  it("deja pasar a un closer con un slug existente", async () => {
    auth.mockResolvedValue(sesionCloser);
    programaActivoPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("paso");
  });

  it("manda al login a quien no tiene sesion, aun con un slug existente", async () => {
    auth.mockResolvedValue(null);
    programaActivoPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("login");
  });

  it("manda al login a quien no tiene sesion, tambien con un slug inexistente", async () => {
    // La guarda corre primero: no se filtra que slugs existen a quien no entro.
    auth.mockResolvedValue(null);
    programaActivoPorSlug.mockResolvedValue(null);
    expect(await correrPrograma(SLUG_NO_EXISTE)).toBe("login");
  });

  it("un slug inexistente o inactivo, con sesion, es 404", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaActivoPorSlug.mockResolvedValue(null);
    expect(await correrPrograma(SLUG_NO_EXISTE)).toBe("notFound");
  });
});

describe("pagina de closer", () => {
  it("/mi-dia rechaza a un gerente y lo manda a su vista", async () => {
    auth.mockResolvedValue(sesionGerente);
    // El gerente rechazado aterriza en su primer programa activo (destinoInicial).
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/programas/programa-a");
  });

  it("/mi-dia manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/login");
  });
});

describe("token vaciado", () => {
  it("una sesion sin id no entra a una pagina de gerente", async () => {
    // Es lo que deja el callback jwt cuando el usuario fue desactivado (S-02/S-03).
    auth.mockResolvedValue({ user: { id: "", email: "x@y.co", rol: null, closerId: null } });
    expect(await destinoDe("@/app/(app)/ajustes/page")).toBe("/login");
  });
});
