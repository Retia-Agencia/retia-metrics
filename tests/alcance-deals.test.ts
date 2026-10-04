import { beforeEach, describe, expect, it, vi } from "vitest";

const paginaConRol = vi.fn();
const rolDeVista = vi.fn();
const programaVisiblePorSlug = vi.fn();
const fichaDeDeal = vi.fn();
const opcionesDeFicha = vi.fn();
const alertasDelDeal = vi.fn();
const notFound = vi.fn(() => { throw new Error("notFound"); });

vi.mock("@/lib/auth/page-guards", () => ({ paginaConRol }));
vi.mock("@/lib/auth/vista", () => ({ rolDeVista }));
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/deals/mover-etapa", async (original) => ({
  ...(await original<typeof import("@/lib/deals/mover-etapa")>()),
  etapaDeCorreccion: vi.fn(async () => null),
}));
vi.mock("@/lib/queries/ficha-deal", () => ({ fichaDeDeal, opcionesDeFicha, alertasDelDeal }));
vi.mock("@/components/page-shell", () => ({ PageShell: () => null }));
vi.mock("@/components/deals/ficha/ficha-acciones", () => ({ FichaAcciones: () => null }));
vi.mock("@/components/deals/ficha/ficha-transicion", () => ({ FichaTransicion: () => null }));
vi.mock("@/components/deals/ficha/ficha-actividades", () => ({ FichaActividades: () => null }));
vi.mock("@/components/deals/ficha/ficha-cabecera", () => ({ FichaCabecera: () => null }));
vi.mock("@/components/deals/ficha/ficha-historial", () => ({ FichaHistorial: () => null }));
vi.mock("@/components/deals/ficha/ficha-llamadas", () => ({ FichaLlamadas: () => null }));
vi.mock("@/components/deals/ficha/ficha-pago", () => ({ FichaPago: () => null }));
vi.mock("@/components/deals/ficha/ficha-origen", () => ({ FichaOrigen: () => null }));
vi.mock("@/components/deals/ficha/ficha-perfil", () => ({ FichaPerfil: () => null }));
vi.mock("@/components/deals/ficha/ficha-lead", () => ({ FichaLead: () => null }));
vi.mock("@/components/deals/ficha/ficha-alertas", () => ({ FichaAlertas: () => null }));

const ID = "3f8a1c2e-0000-4000-8000-000000000001";
const SESSION = { user: { id: "u-closer", email: "closer@retia.co", rol: "closer", closerId: "closer" } };

const FICHA = {
  dealId: ID,
  etapa: "contactado",
  pendiente: null,
  owner: { id: "u-closer", nombre: "Closer" },
  lead: { id: "lead-1", nombre: "Lead", email: "lead@correo.co" },
  cohorte: null,
  anulado: null,
  fechaLimiteSugerida: null,
  llamadas: [],
  actividades: [],
  abonos: [],
  log: [],
  saldo: { abonado: 0, saldo: null, moneda: null },
};

async function abrir() {
  const { default: pagina } = await import("@/app/(app)/p/[programa]/deals/[id]/page");
  return pagina({ params: Promise.resolve({ programa: "programa-a", id: ID }) });
}

beforeEach(() => {
  paginaConRol.mockReset().mockResolvedValue(SESSION);
  rolDeVista.mockReset().mockResolvedValue("closer");
  programaVisiblePorSlug.mockReset().mockResolvedValue({ id: "p-1", slug: "programa-a", nombre: "Programa A" });
  fichaDeDeal.mockReset().mockResolvedValue(FICHA);
  opcionesDeFicha.mockReset().mockResolvedValue({ areas: [], cohortes: [], cohortesDestino: [], motivos: [], owners: [], plataformas: [] });
  alertasDelDeal.mockReset().mockResolvedValue(null);
  notFound.mockClear();
});

describe("alcance de deals desde la sesión (ADR 0075)", () => {
  it("closer ve lo suyo; gerente y developer ven todo", async () => {
    const { alcanceDeDeals } = await import("@/lib/auth/alcance-deals");
    expect(await alcanceDeDeals(SESSION as never)).toEqual({ tipo: "dueno", userId: "u-closer" });
    rolDeVista.mockResolvedValueOnce("gerente");
    expect(await alcanceDeDeals(SESSION as never)).toEqual({ tipo: "todos" });
    rolDeVista.mockResolvedValueOnce("developer");
    expect(await alcanceDeDeals(SESSION as never)).toEqual({ tipo: "todos" });
  });

  it("developer viendo como closer queda acotado a su usuario", async () => {
    const { alcanceDeDeals } = await import("@/lib/auth/alcance-deals");
    const developer = { user: { ...SESSION.user, id: "u-dev", rol: "developer" } };
    rolDeVista.mockResolvedValueOnce("closer");
    expect(await alcanceDeDeals(developer as never)).toEqual({ tipo: "dueno", userId: "u-dev" });
  });
});

describe("ficha de deal", () => {
  it("un closer recibe 404 al forjar la ficha de otro dueño", async () => {
    fichaDeDeal.mockResolvedValueOnce({ ...FICHA, owner: { id: "u-ajeno", nombre: "Ajeno" } });
    await expect(abrir()).rejects.toThrow("notFound");
  });

  it.each([
    ["propio", FICHA.owner],
    ["sin dueño", null],
  ])("un closer abre un deal %s", async (_caso, owner) => {
    fichaDeDeal.mockResolvedValueOnce({ ...FICHA, owner });
    await expect(abrir()).resolves.toBeTruthy();
  });

  it.each(["gerente", "developer"] as const)("%s abre el deal de cualquier dueño", async (rol) => {
    rolDeVista.mockResolvedValue(rol);
    fichaDeDeal.mockResolvedValueOnce({ ...FICHA, owner: { id: "u-ajeno", nombre: "Ajeno" } });
    await expect(abrir()).resolves.toBeTruthy();
  });
});
