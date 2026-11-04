import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSessionDeLectura: vi.fn(),
  rolDeVista: vi.fn(),
  programaVisiblePorSlug: vi.fn(),
  detalleDeCifra: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireSessionDeLectura: mocks.requireSessionDeLectura }));
vi.mock("@/lib/auth/vista", () => ({ rolDeVista: mocks.rolDeVista }));
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug: mocks.programaVisiblePorSlug }));
vi.mock("@/lib/queries/vista-metrica", () => ({ detalleDeCifra: mocks.detalleDeCifra }));

import { detalleDePuntoAccion } from "@/app/(app)/p/[programa]/hub/acciones-graficas";
import { AuthorizationError } from "@/lib/auth/roles";

const input = {
  slug: "programa-a",
  metrica: "cierres" as const,
  desde: "2026-11-01",
  hasta: "2026-11-04",
  cohorteId: null,
  claveCloser: null,
  origen: "/p/programa-a/hub?seccion=dinero",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSessionDeLectura.mockResolvedValue({ user: { id: "u-1" } });
});

// La capacidad es la de la lista de "cierres" y "caja" (hub/lista/page.tsx): quien administra.
it.each(["closer", "paid_trafficker"])("rechaza a %s y no consulta datos", async (rol) => {
  mocks.rolDeVista.mockResolvedValue(rol);
  await expect(detalleDePuntoAccion(input)).rejects.toBeInstanceOf(AuthorizationError);
  expect(mocks.programaVisiblePorSlug).not.toHaveBeenCalled();
  expect(mocks.detalleDeCifra).not.toHaveBeenCalled();
});

it("rechaza un programa fuera del alcance y no consulta datos", async () => {
  mocks.rolDeVista.mockResolvedValue("gerente");
  mocks.programaVisiblePorSlug.mockResolvedValue(null);
  await expect(detalleDePuntoAccion(input)).rejects.toBeInstanceOf(AuthorizationError);
  expect(mocks.detalleDeCifra).not.toHaveBeenCalled();
});

it.each(["gerente", "developer"])("%s recibe el resumen del tramo, con el programa de la sesión", async (rol) => {
  mocks.rolDeVista.mockResolvedValue(rol);
  mocks.programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: "programa-a" });
  mocks.detalleDeCifra.mockResolvedValue({ ok: true });
  await expect(detalleDePuntoAccion(input)).resolves.toEqual({ ok: true });
  expect(mocks.detalleDeCifra).toHaveBeenCalledWith("cierres", expect.objectContaining({
    programId: "p-1",
    periodo: { preset: "custom", a: { desde: "2026-11-01", hasta: "2026-11-04" }, b: null },
  }));
});

it("rechaza un periodo al revés antes de leer la sesión", async () => {
  await expect(detalleDePuntoAccion({ ...input, desde: "2026-11-05" })).rejects.toThrow();
  expect(mocks.requireSessionDeLectura).not.toHaveBeenCalled();
});
