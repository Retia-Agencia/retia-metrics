import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * B-10: los route handlers ya tenian cobertura de permisos, pero ninguna PAGINA la
 * tenia, y `paginaConRol` es lo unico que protege los dashboards con las cifras de
 * caja, la pauta y el comparativo entre closers. `PROJECT.md` regla 6 dice que eso
 * es politica de la empresa, no preferencia de UI.
 *
 * Se invoca el componente de pagina real. Si alguien afloja una guarda, esto falla.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

/** El `redirect` real interrumpe el render lanzando. El mock imita eso. */
class Redireccion extends Error {
  constructor(readonly destino: string) {
    super(`redirect a ${destino}`);
  }
}

const sesionGerente = { user: { id: "u-1", email: "gerente@retia.co", rol: "gerente", closerId: null } };
const sesionCloser = { user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" } };

beforeEach(() => {
  auth.mockReset();
  redirect.mockReset();
  redirect.mockImplementation((destino: string) => {
    throw new Redireccion(destino);
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
  ["/comunicarte", "@/app/(app)/comunicarte/page"],
  ["/tactical-investor", "@/app/(app)/tactical-investor/page"],
  ["/ajustes", "@/app/(app)/ajustes/page"],
  ["/ajustes/fuentes", "@/app/(app)/ajustes/fuentes/page"],
] as const;

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

describe("pagina de closer", () => {
  it("/mi-dia rechaza a un gerente y lo manda a su vista", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/comunicarte");
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
    expect(await destinoDe("@/app/(app)/comunicarte/page")).toBe("/login");
  });
});
