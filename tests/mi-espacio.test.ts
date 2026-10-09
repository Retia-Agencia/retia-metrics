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

// Los enlaces de captacion (086) se prueban contra la base en captacion-del-closer.test.ts.
vi.mock("@/lib/atribucion/captacion-del-closer", () => ({ enlacesDeCaptacion: async () => [] }));

const PROG_A = { id: "p-a", slug: "programa-a", nombre: "Programa A" };
const PROG_B = { id: "p-b", slug: "programa-b", nombre: "Programa B" };

const sesionCloser = {
  user: { id: "u-closer", rol: "closer", closerId: "Nico", name: "Nicolás", email: "nico@x.co", image: null },
};

const sesionGerente = {
  user: { id: "u-gerente", rol: "gerente", closerId: null, name: "Geraldine", email: "gere@x.co", image: null },
};

const sesionPaidTrafficker = {
  user: { id: "u-pauta", rol: "paid_trafficker", closerId: null, name: "Pablo", email: "pauta@x.co", image: null },
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

/** Invoca la página y devuelve el árbol de elementos (para inspeccionar el texto). */
async function renderizar(busqueda: Record<string, string> = {}): Promise<unknown> {
  const modulo = (await import("@/app/(app)/mi-espacio/page")) as {
    default: (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<unknown>;
  };
  return modulo.default({ searchParams: Promise.resolve(busqueda) });
}

/** Todo el texto plano del árbol de un elemento de React, concatenado. */
function textoDelArbol(nodo: unknown): string {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDelArbol).join(" ");
  if (typeof nodo === "object" && "props" in (nodo as Record<string, unknown>)) {
    const props = (nodo as { props?: { children?: unknown } }).props;
    return textoDelArbol(props?.children);
  }
  return "";
}

/**
 * Busca en el árbol de elementos el PRIMER componente cuyo `type` se llama `nombre`
 * (p. ej. `TabCanales`, `TabPorDecidir`, `TabAtencion`). Las secciones de Mi espacio son
 * elementos perezosos: no se ejecutan al correr la página, así que se identifican por el
 * nombre de su función. Devuelve `null` si no aparece.
 */
function tieneComponente(nodo: unknown, nombre: string): boolean {
  if (nodo == null || typeof nodo === "boolean") return false;
  if (Array.isArray(nodo)) return nodo.some((n) => tieneComponente(n, nombre));
  if (typeof nodo !== "object") return false;
  const el = nodo as { type?: unknown; props?: { children?: unknown } };
  const type = el.type;
  if (typeof type === "function") {
    const fn = type as { name?: string; displayName?: string };
    if (fn.name === nombre || fn.displayName === nombre) return true;
  }
  return tieneComponente(el.props?.children, nombre);
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

  it("el developer sin membresías ve el mensaje del dueño con 'Ver como closer' (ticket 177)", async () => {
    auth.mockResolvedValue({
      user: { id: "u-dev", rol: "developer", closerId: null, name: "Dev", email: "dev@x.co", image: null },
    });
    membresiasConCalendlyDe.mockResolvedValue([]);
    const arbol = await renderizar();
    const texto = textoDelArbol(arbol);
    expect(texto).toContain("Ver como closer");
    expect(texto).toContain("según su rol");
    // No le muestra el mensaje de "pídele a tu gerente": no aplica al dueño (ADR 0025).
    expect(texto).not.toContain("pídele a tu gerente");
  });

  it("el developer en vista closer sin membresías ve el mensaje del dueño, no el de 'pídele a tu gerente' (179)", async () => {
    // Vista `closer` sin suplantar: el rol de vista trabaja leads, pero la cuenta de verdad
    // es el dueño y no está suplantando a nadie. Antes del arreglo le pedía hablar con su gerente.
    cookieVista = "closer";
    auth.mockResolvedValue({
      user: { id: "u-dev", rol: "developer", closerId: null, name: "Dev", email: "dev@x.co", image: null },
    });
    membresiasConCalendlyDe.mockResolvedValue([]);
    const texto = textoDelArbol(await renderizar());
    expect(texto).toContain("Ver como closer");
    expect(texto).not.toContain("pídele a tu gerente");
  });

  it("un closer sin membresías ve el mensaje de 'pídele a tu gerente', no el del dueño", async () => {
    membresiasConCalendlyDe.mockResolvedValue([]);
    const arbol = await renderizar();
    const texto = textoDelArbol(arbol);
    expect(texto).toContain("pídele a tu gerente");
    expect(texto).not.toContain("Ver como closer");
  });

  // ─────────────────────────── ticket 179: curado por rol ───────────────────────────

  it("el paid trafficker rinde sin membresías y sin A-04: solo su sección Canales", async () => {
    auth.mockResolvedValue(sesionPaidTrafficker);
    // No carga membresías (no trabaja leads): no debe tocarlas ni ver el mensaje A-04.
    expect(await correr()).toBe("render");
    expect(membresiasConCalendlyDe).not.toHaveBeenCalled();
    // Canales no usa selector de programa: no resuelve alcance.
    expect(programasVisibles).not.toHaveBeenCalled();
    expect(programaVisiblePorSlug).not.toHaveBeenCalled();
    const arbol = await renderizar();
    expect(tieneComponente(arbol, "TabCanales")).toBe(true);
    expect(textoDelArbol(arbol)).not.toContain("pídele a tu gerente");
    expect(textoDelArbol(arbol)).not.toContain("Ver como closer");
  });

  it("el gerente rinde sin membresías y sin A-04: su sección Por decidir con selector de programa", async () => {
    auth.mockResolvedValue(sesionGerente);
    programasVisibles.mockResolvedValue([PROG_A, PROG_B]);
    expect(await correr()).toBe("render");
    // No trabaja leads: ni carga membresías ni ve el mensaje A-04.
    expect(membresiasConCalendlyDe).not.toHaveBeenCalled();
    // Por decidir usa selector: resuelve el alcance (el primero visible sin ?programa).
    expect(programasVisibles).toHaveBeenCalled();
    const arbol = await renderizar();
    expect(tieneComponente(arbol, "TabPorDecidir")).toBe(true);
    expect(textoDelArbol(arbol)).not.toContain("pídele a tu gerente");
  });

  it("el gerente NO ve las secciones del closer (solo lo de su rol)", async () => {
    auth.mockResolvedValue(sesionGerente);
    programasVisibles.mockResolvedValue([PROG_A]);
    const arbol = await renderizar();
    expect(tieneComponente(arbol, "TabNotificaciones")).toBe(false);
    expect(tieneComponente(arbol, "TabMisDeals")).toBe(false);
    expect(tieneComponente(arbol, "TabCanales")).toBe(false);
  });

  it("un closer que forja ?tab=deals cae en Necesita atención", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A]);
    const arbol = await renderizar({ tab: "deals" });
    expect(tieneComponente(arbol, "TabCanales")).toBe(false);
    expect(tieneComponente(arbol, "TabNotificaciones")).toBe(true);
  });

  it("un closer que forja ?tab=por-decidir tampoco la ve: cae en Necesita atención", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A]);
    const arbol = await renderizar({ tab: "por-decidir" });
    expect(tieneComponente(arbol, "TabPorDecidir")).toBe(false);
    expect(tieneComponente(arbol, "TabNotificaciones")).toBe(true);
  });

  it("Mis métricas usa el closer de la sesión efectiva, no uno de la URL", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A]);
    programaVisiblePorSlug.mockResolvedValue(PROG_A);
    const arbol = await renderizar({ tab: "metricas", programa: "programa-a", closer: "forjado" });
    expect(tieneComponente(arbol, "TabMetricas")).toBe(true);
    expect(programaVisiblePorSlug).toHaveBeenCalledWith("u-closer", "closer", "programa-a");
  });

  it("Mis métricas devuelve 404 si el closer pide un programa sin membresía", async () => {
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A]);
    programaVisiblePorSlug.mockResolvedValue(null);
    expect(await correr({ tab: "metricas", programa: "programa-ajeno" })).toBe("notFound");
  });

  it("el developer en vista closer ve las secciones del closer (lo del closer suplantado)", async () => {
    // Suplantación: la sesión efectiva ya llega como un closer de verdad (rol closer, su
    // id y membresías). La página la trata igual que a un closer real.
    auth.mockResolvedValue({
      user: { id: "u-closer", rol: "closer", closerId: "Nico", name: "Nicolás", email: "nico@x.co", image: null, suplantadoPor: { id: "u-dev", nombre: "Dev" } },
    });
    membresiasConCalendlyDe.mockResolvedValue([
      { id: "m-a", userId: "u-closer", usuario: "Nicolás", emailUsuario: "nico@x.co", programId: "p-a", calendlyEmail: null },
    ]);
    programasVisibles.mockResolvedValue([PROG_A]);
    const arbol = await renderizar();
    expect(tieneComponente(arbol, "TabNotificaciones")).toBe(true);
    expect(tieneComponente(arbol, "TabPorDecidir")).toBe(false);
  });

  it("el developer en vista gerente ve las secciones del gerente", async () => {
    // Vista `gerente`: `rolDeVista` proyecta a gerente, así que la página pinta Por decidir.
    cookieVista = "gerente";
    auth.mockResolvedValue({
      user: { id: "u-dev", rol: "developer", closerId: null, name: "Dev", email: "dev@x.co", image: null },
    });
    programasVisibles.mockResolvedValue([PROG_A]);
    const arbol = await renderizar();
    expect(tieneComponente(arbol, "TabPorDecidir")).toBe(true);
    expect(tieneComponente(arbol, "TabNotificaciones")).toBe(false);
  });

  it("el developer en vista todo ve el mensaje que lo explica (no hay sección propia)", async () => {
    cookieVista = "todo";
    auth.mockResolvedValue({
      user: { id: "u-dev", rol: "developer", closerId: null, name: "Dev", email: "dev@x.co", image: null },
    });
    const arbol = await renderizar();
    const texto = textoDelArbol(arbol);
    expect(texto).toContain("Ver como closer");
    expect(texto).toContain("según su rol");
    expect(tieneComponente(arbol, "TabNotificaciones")).toBe(false);
    expect(tieneComponente(arbol, "TabPorDecidir")).toBe(false);
  });
});
