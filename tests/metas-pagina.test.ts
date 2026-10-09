import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rolDeVista: vi.fn(),
  programaVisiblePorSlug: vi.fn(),
  leerMetasDelMes: vi.fn(),
}));

class Redireccion extends Error {
  constructor(readonly destino: string) { super(destino); }
}
class NoEncontrado extends Error {}

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/vista", () => ({
  rolDeVista: mocks.rolDeVista,
  sesionEfectiva: async (session: unknown) => session,
}));
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug: mocks.programaVisiblePorSlug }));
vi.mock("@/lib/queries/metas", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/queries/metas")>(),
  leerMetasDelMes: mocks.leerMetasDelMes,
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => { throw new Redireccion(destino); },
  permanentRedirect: (destino: string) => { throw new Redireccion(destino); },
  notFound: () => { throw new NoEncontrado(); },
}));
vi.mock("@/lib/format", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/format")>(),
  hoyEnBogota: () => "2026-10-04",
}));

const resultado = {
  mes: "2026-10",
  periodoMes: { desde: "2026-10-01", hasta: "2026-10-31" },
  filas: [],
  cohortesSinVentana: [],
  mesSinVentana: true,
  metaCupos: 0,
  metaUsd: 0,
  vendidos: 0,
  esperado: 0,
  deuda: 0,
  deudaPct: null,
  contratadoUsd: 0,
  ventasSinValorVendido: 0,
  compensacionSemanal: null,
  compensacionCohorte: null,
};

async function correr() {
  const pagina = await import("@/app/(app)/p/[programa]/metas/page");
  try {
    await pagina.default({
      params: Promise.resolve({ programa: "comunicarte" }),
      searchParams: Promise.resolve({ mes: "2026-10" }),
    });
    return "paso";
  } catch (error) {
    if (error instanceof Redireccion) return error.destino;
    if (error instanceof NoEncontrado) return "404";
    throw error;
  }
}

describe("146: guarda de la página de metas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rolDeVista.mockResolvedValue("gerente");
    mocks.leerMetasDelMes.mockResolvedValue(resultado);
  });

  it("sin sesión redirige a login", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await correr()).toBe("/login");
    expect(mocks.leerMetasDelMes).not.toHaveBeenCalled();
  });

  it("un closer recibe 404 por rol, aunque el programa esté en su alcance (ticket 224, ADR 0082)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-1", email: "closer@example.test", rol: "closer" } });
    mocks.rolDeVista.mockResolvedValue("closer");
    // El programa SÍ está en su alcance: aun así, Metas cae con el Dashboard para el closer.
    mocks.programaVisiblePorSlug.mockResolvedValue({ id: "programa-1", slug: "comunicarte", nombre: "ComunicArte" });
    expect(await correr()).toBe("404");
    expect(mocks.leerMetasDelMes).not.toHaveBeenCalled();
  });

  it("un paid trafficker ve las Metas (ve el tablero, ADR 0052/ticket 102)", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-3", email: "pauta@example.test", rol: "paid_trafficker" } });
    mocks.rolDeVista.mockResolvedValue("paid_trafficker");
    mocks.programaVisiblePorSlug.mockResolvedValue({ id: "programa-1", slug: "comunicarte", nombre: "ComunicArte" });
    expect(await correr()).toBe("paso");
    expect(mocks.leerMetasDelMes).toHaveBeenCalledWith("programa-1", "2026-10", "2026-10-04");
  });

  it("el gerente llega al lector con el id del programa", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u-2", email: "gerente@example.test", rol: "gerente" } });
    mocks.programaVisiblePorSlug.mockResolvedValue({ id: "programa-1", slug: "comunicarte", nombre: "ComunicArte" });
    expect(await correr()).toBe("paso");
    expect(mocks.leerMetasDelMes).toHaveBeenCalledWith("programa-1", "2026-10", "2026-10-04");
  });
});
