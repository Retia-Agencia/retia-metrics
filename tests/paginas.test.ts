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
 * El dashboard vive en una ruta dinamica `/p/[programa]/dashboard` (ADR 0012): un solo
 * componente sirve a todos los programas, que salen de la base. La guarda corre
 * antes de mirar el slug, asi que sin sesion redirige a login sin filtrar que
 * slugs existen; un slug inexistente o inactivo, ya con sesion, es 404.
 *
 * Se invoca el componente de pagina real. Si alguien afloja una guarda, esto falla.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

/**
 * La cookie de vista (ticket 028) la lee `rolDeVista` via `next/headers`, que fuera de
 * un request real lanza. Se mockea con un store controlable: `ponerVista` fija el
 * valor de la cookie para un test; por defecto no hay cookie (vista `todo`).
 */
let cookieDeVista: string | undefined;
function ponerVista(v: string | undefined) {
  cookieDeVista = v;
}
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieDeVista !== undefined
        ? { name: nombre, value: cookieDeVista }
        : undefined,
  }),
}));

const redirect = vi.fn();
const permanentRedirect = vi.fn();
const notFound = vi.fn();
vi.mock("next/navigation", () => ({ redirect, permanentRedirect, notFound }));

// La pagina dinamica de programa lee la base; en los tests no hay base, asi que se
// mockea la query. `programaActivoPorSlug` devuelve un programa para los slugs
// "existentes" y null para el resto, imitando "no existe o esta inactivo".
const programaActivoPorSlug = vi.fn();
const programasActivos = vi.fn();
const programaPorSlug = vi.fn();
const programasGestionablesPorUsuario = vi.fn();
vi.mock("@/lib/queries/programas", () => ({
  programaActivoPorSlug,
  programasActivos,
  programaPorSlug,
  programasGestionablesPorUsuario,
}));

// El dashboard de programa y el layout resuelven el programa y el selector contra la
// funcion de alcance (ADR 0048, ticket 094), no contra `programasActivos`. Se mockea
// para poder simular "este programa esta / no esta dentro del alcance de la sesion".
const programaVisiblePorSlug = vi.fn();
const programasVisibles = vi.fn();
const idsDeProgramasVisibles = vi.fn();
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug, programasVisibles, idsDeProgramasVisibles }));

// La ficha del lead (ticket 073) y la redireccion de `/personas/[id]` leen la base; sin
// base en los tests se mockean las queries para que las guardas y el 404 sean lo unico
// bajo prueba.
const fichaDeLead = vi.fn();
const slugDelLeadVisible = vi.fn();
vi.mock("@/lib/queries/ficha-lead", () => ({ fichaDeLead, slugDelLeadVisible }));
const otrosProgramasDelCorreo = vi.fn();
vi.mock("@/lib/queries/otros-programas-del-correo", () => ({ otrosProgramasDelCorreo }));

// La pagina de recursos (ticket 023) lee la base; sin base en los tests se mockean
// las lecturas para que las guardas sean lo unico bajo prueba.
const recursosVigentes = vi.fn();
const enlacesDePagoVigentes = vi.fn();
const historialesDeRecursos = vi.fn();
vi.mock("@/lib/queries/recursos", () => ({
  recursosVigentes,
  enlacesDePagoVigentes,
  historialesDeRecursos,
}));

// El dashboard (ticket 005) arma su vista con `armarVistaDelDashboard`; sin base en
// los tests se mockea para poder mirar CON QUE lo llama cada rol.
const armarVistaDelDashboard = vi.fn();
vi.mock("@/lib/queries/vista-dashboard", () => ({ armarVistaDelDashboard }));
const armarVistaDeTodos = vi.fn();
vi.mock("@/lib/queries/vista-todos", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/queries/vista-todos")>(),
  armarVistaDeTodos,
}));
const detallesDelDashboard = vi.fn(async () => ({}));
const vistaDeLista = vi.fn();
vi.mock("@/lib/queries/vista-metrica", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/queries/vista-metrica")>(),
  detallesDelDashboard,
  vistaDeLista,
}));
// La vista interina de Pauta (093) tambien lee la base: aqui solo importa que la pagina pase.
const pautaInterina = vi.fn(async () => ({
  filas: [],
  resumen: { registros: 0, sinUtm: 0, macro: 0, agendas: 0, agendasSinEnvioDeOrigen: 0 },
  sinUtmHoy: [],
}));
vi.mock("@/lib/queries/pauta-interina", () => ({ pautaInterina }));
// La serie del embudo (089), igual: sin base, una serie vacia.
const hechosDelEmbudo = vi.fn(async () => []);
vi.mock("@/lib/queries/hechos-embudo", () => ({ hechosDelEmbudo }));
const embudoDelFormulario = vi.fn(async () => ({
  filas: [],
  total: { dejoDatos: 0, completo: 0, llegoCalendly: 0, agendo: 0 },
  sinCalidad: 0,
}));
vi.mock("@/lib/queries/embudo-formulario", () => ({ embudoDelFormulario }));
const registrosYAgendasPorCanal = vi.fn(async () => ({ filas: [], total: { registros: 0, agendas: 0 } }));
vi.mock("@/lib/queries/registros-agendas-canal", () => ({ registrosYAgendasPorCanal }));
// Los nombres de canal del bloque Origen por canal (129), igual: sin base, catalogo vacio.
const nombresDeCanales = vi.fn(async () => new Map());
vi.mock("@/lib/queries/dashboard", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/queries/dashboard")>(),
  nombresDeCanales,
}));
// Deals creados contra agendas (138), igual: sin base, la gráfica no disponible.
const vistaDealsContraAgendas = vi.fn(async () => ({ disponible: false }));
vi.mock("@/lib/queries/vista-deals-contra-agendas", () => ({ vistaDealsContraAgendas }));

// La pagina de cohortes lee las cohortes del programa; sin base en los tests, se
// mockea la lectura para que la guarda sea lo unico bajo prueba.
const listarCohortes = vi.fn();
vi.mock("@/lib/catalogo/cohortes", () => ({ listarCohortes }));

// `/mi-dia` (ticket 003) ofrece solo los catalogos ACTIVOS. Sin base en los tests se
// mockea `.listar()` de cada catalogo para que la guarda de rol sea lo unico bajo
// prueba, pero se preservan los demas exports (esquemas zod) que otras paginas
// (`/ajustes/catalogos`) importan del mismo modulo.
const listarVacio = vi.fn(async () => []);
vi.mock("@/lib/catalogo/motivos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogo/motivos")>()),
  motivos: () => ({ listar: listarVacio }),
}));
vi.mock("@/lib/catalogo/origenes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogo/origenes")>()),
  origenes: () => ({ listar: listarVacio }),
}));
vi.mock("@/lib/catalogo/plataformas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogo/plataformas")>()),
  plataformasDePago: () => ({ listar: listarVacio }),
  vinculosDePlataformas: vi.fn(async () => new Map<string, string[]>()),
}));
vi.mock("@/lib/catalogo/areas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogo/areas")>()),
  areas: () => ({ listar: listarVacio }),
}));
// La pagina de recursos (ticket 023) ofrece las categorias ACTIVAS en su formulario;
// se mockea `.listar()` preservando el esquema zod que el resto del modulo exporta.
vi.mock("@/lib/catalogo/categorias-recurso", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogo/categorias-recurso")>()),
  categoriasDeRecurso: () => ({ listar: listarVacio }),
}));

// `/nerd-stats` (ticket 025) lee la base por dos modulos; sin base en los tests se
// mockean para que la guarda sea lo unico bajo prueba. `@/lib/queries/fuentes` se
// mockea entero: las paginas de gerente solo se prueban por rechazo, asi que nadie
// mas depende de su implementacion real aca.
const ultimasCorridasDeSync = vi.fn(async () => []);
vi.mock("@/lib/queries/fuentes", () => ({
  ultimasCorridasDeSync,
  estadoDeFuentes: vi.fn(async () => ({ fuentes: [], conteos: [], corridas: [], cambios: 0 })),
}));
vi.mock("@/lib/queries/nerd-stats", () => ({
  conteosPorPrograma: vi.fn(async () => []),
  conteosPorOrigen: vi.fn(async () => ({ llamadas: [], ventas: [] })),
  ultimosCambiosDesdeLaApp: vi.fn(async () => []),
  usuariosActivosPorRol: vi.fn(async () => []),
}));

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
const sesionDeveloper = { user: { id: "u-3", email: "dev@retia.co", rol: "developer", closerId: null } };

beforeEach(() => {
  auth.mockReset();
  cookieDeVista = undefined;
  redirect.mockReset();
  permanentRedirect.mockReset();
  notFound.mockReset();
  programaActivoPorSlug.mockReset();
  programasActivos.mockReset();
  programaPorSlug.mockReset();
  programaVisiblePorSlug.mockReset();
  programasVisibles.mockReset();
  programasVisibles.mockResolvedValue([]);
  listarCohortes.mockReset();
  listarCohortes.mockResolvedValue([]);
  programasGestionablesPorUsuario.mockReset();
  programasGestionablesPorUsuario.mockResolvedValue([]);
  listarVacio.mockClear();
  fichaDeLead.mockReset();
  fichaDeLead.mockResolvedValue(FICHA_VACIA);
  slugDelLeadVisible.mockReset();
  slugDelLeadVisible.mockResolvedValue("programa-a");
  otrosProgramasDelCorreo.mockReset();
  otrosProgramasDelCorreo.mockResolvedValue([]);
  idsDeProgramasVisibles.mockReset();
  idsDeProgramasVisibles.mockResolvedValue(new Set());
  recursosVigentes.mockReset();
  recursosVigentes.mockResolvedValue([]);
  enlacesDePagoVigentes.mockReset();
  enlacesDePagoVigentes.mockResolvedValue([]);
  historialesDeRecursos.mockReset();
  historialesDeRecursos.mockResolvedValue(new Map());
  armarVistaDelDashboard.mockReset();
  armarVistaDelDashboard.mockResolvedValue(VISTA_VACIA);
  armarVistaDeTodos.mockReset();
  armarVistaDeTodos.mockResolvedValue(VISTA_TODOS_VACIA);
  // Por defecto, un gerente rechazado de una pagina de closer aterriza en su primer
  // programa activo. `destinoInicial("gerente")` consulta esta lista.
  programasActivos.mockResolvedValue([{ slug: "programa-a", nombre: "Programa A" }]);
  redirect.mockImplementation((destino: string) => {
    throw new Redireccion(destino);
  });
  // `permanentRedirect` corta el render igual que `redirect`; se reconoce por el
  // mismo destino para que `destinoDe` lo reporte (documentos -> recursos).
  permanentRedirect.mockImplementation((destino: string) => {
    throw new Redireccion(destino);
  });
  notFound.mockImplementation(() => {
    throw new NoEncontrado();
  });
});

/** Una vista sin datos, suficiente para que la pagina renderice en los tests. */
const VISTA_VACIA = {
  periodo: { preset: "hoy", a: { desde: "2026-09-15", hasta: "2026-09-15" }, b: { desde: "2026-09-14", hasta: "2026-09-14" } },
  anteriorDisponible: false,
  seleccion: { preset: "hoy", rango: { desde: "2026-09-15", hasta: "2026-09-15" } },
  closerId: null,
  closers: [],
  embudo: { agendas: 0, llamadasConShow: 0, pctShow: null, cierres: 0, ventas: 0, pctCierre: null },
  caja: [],
  leads: { leads: 0, diasHabiles: 1, metaLeadsDia: null, metaDelRango: null, cumplimiento: null },
  cohorte: null,
  compromisos: 0,
  motivos: [],
  origenes: [],
  comparativo: [],
};

const VISTA_TODOS_VACIA = {
  periodo: VISTA_VACIA.periodo,
  a: { leads: { tipo: "conteo", valor: 0 }, agendas: { tipo: "conteo", valor: 0 }, shows: { tipo: "conteo", valor: 0 }, cierres: { tipo: "conteo", valor: 0 }, caja: [] },
  b: null,
  detalles: Object.fromEntries(["leads", "agendas", "shows", "cierres", "caja"].map((metrica) => [metrica, {
    resumen: { programId: "todos", disponible: true, subtotal: { cantidad: 0, caja: [] }, grupos: [] },
    desgloses: { porCloser: [], porEtapa: [], porAntiguedad: [] },
    href: `/dashboard/lista?metrica=${metrica}`,
  }])),
  programas: [],
};

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
  ["/ajustes/fuentes", "@/app/(app)/ajustes/fuentes/page"],
  ["/ajustes/usuarios", "@/app/(app)/ajustes/usuarios/page"],
  ["/ajustes/programas", "@/app/(app)/ajustes/programas/page"],
  ["/ajustes/migracion", "@/app/(app)/ajustes/migracion/page"],
] as const;

/**
 * `/ajustes` y `/ajustes/catalogos` dejaron de ser exclusivas de gerente el 20-sep
 * (enmienda del ticket 013): un closer administra las plataformas de pago, asi que
 * entra a las dos. La guarda baja a cada SUBPAGINA — las de arriba siguen rebotandolo—
 * y lo que el closer ve adentro es una PROYECCION, no un permiso: las server actions
 * vuelven a exigir el rol.
 */
const PAGINAS_COMPARTIDAS_CON_CLOSER = [
  ["/ajustes", "@/app/(app)/ajustes/page"],
  ["/ajustes/catalogos", "@/app/(app)/ajustes/catalogos/page"],
] as const;

/**
 * El dashboard de programa vive en una ruta dinamica `/p/[programa]/dashboard`
 * (ticket 097; antes `/programas/[slug]`, que ahora solo redirige). Se
 * invoca el componente real con `params` como Promise (Next 16). La guarda corre
 * ANTES de mirar el slug: sin sesion redirige a login aunque el slug no exista, y
 * nunca filtra que slugs existen.
 */
const RUTA_PROGRAMA = "@/app/(app)/p/[programa]/dashboard/page";

/** Ejecuta la pagina de programa con un slug y devuelve que hizo. */
async function correrPrograma(
  slug: string,
  busqueda: Record<string, string> = {},
): Promise<"paso" | "login" | "midia" | "notFound"> {
  const modulo = (await import(/* @vite-ignore */ RUTA_PROGRAMA)) as {
    default: (props: {
      params: Promise<{ programa: string }>;
      searchParams: Promise<Record<string, string | string[] | undefined>>;
    }) => Promise<unknown>;
  };
  try {
    await modulo.default({
      params: Promise.resolve({ programa: slug }),
      searchParams: Promise.resolve(busqueda),
    });
    return "paso";
  } catch (e) {
    if (e instanceof NoEncontrado) return "notFound";
    if (e instanceof Redireccion) return e.destino === "/login" ? "login" : "midia";
    throw e;
  }
}

/** Ejecuta el dashboard superior con los programas ya acotados por la sesión. */
async function correrTodos(
  busqueda: Record<string, string> = {},
): Promise<"paso" | "login" | "midia" | "notFound"> {
  const modulo = (await import("@/app/(app)/dashboard/page")) as {
    default: (props: {
      searchParams: Promise<Record<string, string | string[] | undefined>>;
    }) => Promise<unknown>;
  };
  try {
    await modulo.default({ searchParams: Promise.resolve(busqueda) });
    return "paso";
  } catch (e) {
    if (e instanceof NoEncontrado) return "notFound";
    if (e instanceof Redireccion) return e.destino === "/login" ? "login" : "midia";
    throw e;
  }
}

describe("dashboard de todos los programas (ticket 095)", () => {
  it("requiere sesión", async () => {
    auth.mockResolvedValue(null);
    expect(await correrTodos()).toBe("login");
  });

  it("un closer solo entrega a la vista sus programas visibles", async () => {
    auth.mockResolvedValue(sesionCloser);
    const suyo = { id: "p-1", slug: "programa-a", nombre: "Programa A" };
    programasVisibles.mockResolvedValue([suyo]);

    expect(await correrTodos()).toBe("paso");
    expect(armarVistaDeTodos).toHaveBeenCalledWith(expect.objectContaining({ programas: [suyo] }));
  });

  it("un programa sin membresía nunca llega al constructor", async () => {
    auth.mockResolvedValue(sesionCloser);
    programasVisibles.mockResolvedValue([{ id: "p-1", slug: "programa-a", nombre: "Programa A" }]);

    await correrTodos();
    const entrada = armarVistaDeTodos.mock.calls[0][0];
    expect(entrada.programas.map((p: { slug: string }) => p.slug)).not.toContain("programa-ajeno");
  });

  it("sin programas visibles responde 404", async () => {
    auth.mockResolvedValue(sesionCloser);
    programasVisibles.mockResolvedValue([]);
    expect(await correrTodos()).toBe("notFound");
  });
});

describe("paginas de ajustes compartidas con el closer (enmienda 013, 20-sep)", () => {
  for (const [nombre, ruta] of PAGINAS_COMPARTIDAS_CON_CLOSER) {
    it(`${nombre} DEJA entrar a un closer (ya no lo rebota)`, async () => {
      auth.mockResolvedValue(sesionCloser);
      programasGestionablesPorUsuario.mockResolvedValue([]);
      expect(await destinoDe(ruta)).toBeNull();
    });

    it(`${nombre} deja entrar al developer, que administra (ADR 0025)`, async () => {
      auth.mockResolvedValue(sesionDeveloper);
      programasActivos.mockResolvedValue([]);
      expect(await destinoDe(ruta)).toBeNull();
    });

    it(`${nombre} manda al login a quien no tiene sesion`, async () => {
      auth.mockResolvedValue(null);
      expect(await destinoDe(ruta)).toBe("/login");
    });
  }
});

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

/**
 * El developer (ADR 0025) pasa TODA guarda de pagina. No se afirma renderizando
 * cada pagina (varias leen la base y aqui no hay base), sino sobre `paginaConRol`,
 * que es lo unico que la pagina evalua para decidir el acceso: si la guarda no
 * redirige, la pagina entra. Se cubre una guarda exclusiva de gerente y una
 * exclusiva de closer; el mecanismo es el mismo para todas.
 */
describe("developer pasa toda guarda de pagina (ADR 0025)", () => {
  it("no lo redirige una guarda exclusiva de gerente", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    const { paginaConRol } = await import("@/lib/auth/page-guards");
    const session = await paginaConRol("gerente");
    expect(session.user.rol).toBe("developer");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("no lo redirige una guarda exclusiva de closer", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    const { paginaConRol } = await import("@/lib/auth/page-guards");
    const session = await paginaConRol("closer");
    expect(session.user.rol).toBe("developer");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a un gerente SI lo redirige una guarda exclusiva de closer (disjuncion, ADR 0003)", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { paginaConRol } = await import("@/lib/auth/page-guards");
    await expect(paginaConRol("closer")).rejects.toBeInstanceOf(Redireccion);
  });
});

describe("dashboard de programa /p/[programa]/dashboard (ADR 0048 + 0012)", () => {
  const SLUG_EXISTE = "programa-a";
  const SLUG_NO_EXISTE = "no-existe";

  it("deja pasar a un gerente con un slug existente", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("paso");
  });

  it("deja pasar a un closer con un slug dentro de su alcance", async () => {
    auth.mockResolvedValue(sesionCloser);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("paso");
  });

  it("deja pasar a un developer con un slug existente (ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("paso");
  });

  it("manda al login a quien no tiene sesion, aun con un slug existente", async () => {
    auth.mockResolvedValue(null);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: SLUG_EXISTE, nombre: "Programa A" });
    expect(await correrPrograma(SLUG_EXISTE)).toBe("login");
  });

  it("manda al login a quien no tiene sesion, tambien con un slug inexistente", async () => {
    // La guarda corre primero: no se filtra que slugs existen a quien no entro.
    auth.mockResolvedValue(null);
    programaVisiblePorSlug.mockResolvedValue(null);
    expect(await correrPrograma(SLUG_NO_EXISTE)).toBe("login");
  });

  it("un slug inexistente o inactivo, con sesion, es 404", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaVisiblePorSlug.mockResolvedValue(null);
    expect(await correrPrograma(SLUG_NO_EXISTE)).toBe("notFound");
  });

  it("un closer con el slug de un programa FUERA de su alcance recibe 404, no 403 (ADR 0048, ticket 094)", async () => {
    // `programaVisiblePorSlug` devuelve null cuando el programa existe pero es de otro
    // programa que esta sesion no ve: la pagina no lo distingue de un slug inexistente,
    // asi que no se filtra que slugs existen. Es 404, jamas 403.
    auth.mockResolvedValue(sesionCloser);
    programaVisiblePorSlug.mockResolvedValue(null);
    expect(await correrPrograma("programa-ajeno")).toBe("notFound");
  });
});

describe("el dashboard no depende del rol dentro del alcance (ADR 0048, ticket 005)", () => {
  const SLUG = "programa-a";
  const BUSQUEDA = { rango: "semana", closer: "Ana" };

  beforeEach(() => {
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: SLUG, nombre: "Programa A" });
  });

  it("un closer y un gerente piden exactamente la misma vista", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrPrograma(SLUG, BUSQUEDA)).toBe("paso");
    const comoGerente = armarVistaDelDashboard.mock.calls.at(-1);

    auth.mockResolvedValue(sesionCloser);
    expect(await correrPrograma(SLUG, BUSQUEDA)).toBe("paso");
    const comoCloser = armarVistaDelDashboard.mock.calls.at(-1);

    // Sin esto, una pagina que no arme ninguna vista pasaria el test con dos
    // `undefined` iguales.
    expect(comoGerente).toBeDefined();
    expect(comoCloser).toBeDefined();

    // Mismos argumentos = mismos numeros. La vista no recibe rol ni sesion, asi que
    // no hay donde esconder una diferencia.
    expect(comoCloser).toEqual(comoGerente);
  });

  it("el closer logueado no se cuela como filtro: se filtra por lo que diga la URL", async () => {
    // Un closer que abre el dashboard sin filtro ve el programa entero, no lo suyo.
    auth.mockResolvedValue(sesionCloser);
    expect(await correrPrograma(SLUG)).toBe("paso");
    expect(armarVistaDelDashboard.mock.calls.at(-1)![0]).toMatchObject({
      programId: "p-1",
      closerId: null,
    });
  });

  it("el periodo nuevo se valida en el borde de la página", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrPrograma(SLUG, { periodo: "este_mes", b_desde: "2026-08-01", b_hasta: "2026-08-07" })).toBe("paso");
    expect(armarVistaDelDashboard.mock.calls.at(-1)![0]).toMatchObject({
      periodo: { preset: "este_mes", b: { desde: "2026-08-01", hasta: "2026-08-07" } },
    });
  });

  it("el filtro de la URL llega a la vista", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrPrograma(SLUG, { rango: "custom", desde: "2026-09-01", hasta: "2026-09-10", closer: "Beto" })).toBe("paso");
    expect(armarVistaDelDashboard.mock.calls.at(-1)![0]).toMatchObject({
      preset: "custom",
      desde: "2026-09-01",
      hasta: "2026-09-10",
      closerId: "Beto",
    });
  });
});

/**
 * Las rutas viejas y la raiz de un programa solo redirigen (ticket 097): el filtro de la
 * URL viaja intacto, y es la ruta nueva la que valida el programa.
 */
describe("redirecciones al programa como segmento (ticket 097)", () => {
  async function destinoConParams(
    ruta: string,
    params: Record<string, string>,
    busqueda: Record<string, string | string[]> = {},
  ): Promise<string | null> {
    const modulo = (await import(/* @vite-ignore */ ruta)) as {
      default: (props: {
        params: Promise<Record<string, string>>;
        searchParams: Promise<Record<string, string | string[]>>;
      }) => Promise<unknown>;
    };
    try {
      await modulo.default({ params: Promise.resolve(params), searchParams: Promise.resolve(busqueda) });
      return null;
    } catch (e) {
      if (e instanceof Redireccion) return e.destino;
      throw e;
    }
  }

  it("/programas/[slug] lleva al Dashboard del programa, con el filtro intacto", async () => {
    expect(
      await destinoConParams(
        "@/app/(app)/programas/[slug]/page",
        { slug: "programa-a" },
        { rango: "mes", closer: "Maru" },
      ),
    ).toBe("/p/programa-a/dashboard?rango=mes&closer=Maru");
    expect(await destinoConParams("@/app/(app)/programas/[slug]/page", { slug: "programa-a" })).toBe(
      "/p/programa-a/dashboard",
    );
  });

  it("/p/[programa] a secas entra por la tab por defecto", async () => {
    expect(await destinoConParams("@/app/(app)/p/[programa]/page", { programa: "programa-a" })).toBe(
      "/p/programa-a/dashboard",
    );
  });
});

describe("cohortes de un programa /ajustes/programas/[slug] (ticket 014)", () => {
  const RUTA_COHORTES = "@/app/(app)/ajustes/programas/[slug]/page";
  const SLUG = "programa-a";

  async function correrCohortes(slug: string): Promise<"paso" | "login" | "midia" | "notFound"> {
    const modulo = (await import(/* @vite-ignore */ RUTA_COHORTES)) as {
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

  it("rechaza a un closer y lo manda a su vista (solo gerente, ADR 0003)", async () => {
    auth.mockResolvedValue(sesionCloser);
    programaPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG, nombre: "Programa A", activo: true });
    expect(await correrCohortes(SLUG)).toBe("midia");
  });

  it("manda al login a quien no tiene sesion, aun con un slug existente", async () => {
    auth.mockResolvedValue(null);
    programaPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG, nombre: "Programa A", activo: true });
    expect(await correrCohortes(SLUG)).toBe("login");
  });

  it("deja pasar a un gerente con un slug existente", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG, nombre: "Programa A", activo: true });
    expect(await correrCohortes(SLUG)).toBe("paso");
  });

  it("deja pasar a un developer con un slug existente (ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    programaPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG, nombre: "Programa A", activo: true });
    expect(await correrCohortes(SLUG)).toBe("paso");
  });

  it("un slug inexistente, con sesion de gerente, es 404", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaPorSlug.mockResolvedValue(null);
    expect(await correrCohortes("no-existe")).toBe("notFound");
  });
});

describe("pagina de recursos /recursos (ticket 023)", () => {
  const RUTA = "@/app/(app)/recursos/page";

  /** La pagina de recursos recibe `searchParams` (filtro por URL, ADR 0023). */
  async function correrRecursos(
    busqueda: Record<string, string> = {},
  ): Promise<string | null> {
    const modulo = (await import(/* @vite-ignore */ RUTA)) as {
      default: (props: {
        searchParams: Promise<Record<string, string | string[] | undefined>>;
      }) => Promise<unknown>;
    };
    try {
      await modulo.default({ searchParams: Promise.resolve(busqueda) });
      return null;
    } catch (e) {
      if (e instanceof Redireccion) return e.destino;
      throw e;
    }
  }

  /**
   * La prop `esAdmin` que la pagina le pasa a `<RecursosPantalla>` (ticket 028): decide
   * si se ven los controles de edicion de TODO (globales + cualquier programa). La
   * pagina devuelve `<PageShell><RecursosPantalla esAdmin=.../></PageShell>`, asi que se
   * lee del hijo del elemento devuelto. No se renderiza: se inspecciona el arbol.
   */
  async function puedeEditarDeRecursos(
    busqueda: Record<string, string> = {},
  ): Promise<boolean | undefined> {
    const modulo = (await import(/* @vite-ignore */ RUTA)) as {
      default: (props: {
        searchParams: Promise<Record<string, string | string[] | undefined>>;
      }) => Promise<{ props: { children: { props: { esAdmin: boolean } } } }>;
    };
    const elemento = await modulo.default({ searchParams: Promise.resolve(busqueda) });
    return elemento.props.children.props.esAdmin;
  }

  it("deja pasar a un gerente (lee y administra)", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrRecursos()).toBeNull();
  });

  it("deja pasar a un closer (ambos roles leen, ADR 0009)", async () => {
    auth.mockResolvedValue(sesionCloser);
    expect(await correrRecursos()).toBeNull();
  });

  it("manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await correrRecursos()).toBe("/login");
  });

  it("el filtro de la URL (programa y titulo) llega a la consulta", async () => {
    auth.mockResolvedValue(sesionGerente);
    programasActivos.mockResolvedValue([
      { id: "p-1", slug: "comunicarte", nombre: "Comunicarte" },
    ]);
    expect(await correrRecursos({ programa: "comunicarte", q: "brochure" })).toBeNull();
    expect(recursosVigentes).toHaveBeenCalled();
    // El slug se resolvio al uuid del programa y ambos filtros llegaron a la consulta.
    expect(recursosVigentes.mock.calls.at(-1)![0]).toMatchObject({
      programId: "p-1",
      q: "brochure",
    });
  });

  /**
   * El criterio central del ticket 028 sobre `/recursos`: un developer VE los
   * controles de edicion segun su VISTA, no segun su rol de sesion. En vista `todo` o
   * `gerente` los ve (`puedeEditar` true); en vista `closer` NO (un closer no
   * administra). Se captura la prop `puedeEditar` que la pagina le pasa a la pantalla.
   */
  it("developer en vista 'gerente' VE los controles de edicion", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("gerente");
    expect(await puedeEditarDeRecursos()).toBe(true);
  });

  it("developer en vista 'todo' (por defecto) VE los controles de edicion", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("todo");
    expect(await puedeEditarDeRecursos()).toBe(true);
  });

  it("developer en vista 'closer' NO ve los controles de edicion", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("closer");
    expect(await puedeEditarDeRecursos()).toBe(false);
  });

  it("un closer real con cookie 'gerente' a mano NO ensancha: sigue sin controles", async () => {
    // Estrechar nunca otorga (ticket 028): la vista se ignora para un no-developer.
    auth.mockResolvedValue(sesionCloser);
    ponerVista("gerente");
    expect(await puedeEditarDeRecursos()).toBe(false);
  });

  it("un gerente sigue viendo los controles, con o sin cookie", async () => {
    auth.mockResolvedValue(sesionGerente);
    ponerVista("closer");
    // La cookie 'closer' no lo estrecha: no es developer.
    expect(await puedeEditarDeRecursos()).toBe(true);
  });
});

describe("pagina de personas /personas (18-sep: la puerta al historial)", () => {
  const RUTA = "@/app/(app)/personas/page";

  async function correrPersonas(): Promise<string | null> {
    const modulo = (await import(/* @vite-ignore */ RUTA)) as {
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

  /**
   * El punto entero de esta pagina: `/personas/[id]` ya dejaba entrar al gerente,
   * pero el unico enlace hacia alla vivia en `/mi-dia`, exclusiva de closer, asi que
   * el gerente no tenia ruta al historial de ningun lead.
   */
  it("deja pasar a un gerente, que antes no tenia ruta al historial", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrPersonas()).toBeNull();
  });

  it("deja pasar a un closer (ADR 0009)", async () => {
    auth.mockResolvedValue(sesionCloser);
    expect(await correrPersonas()).toBeNull();
  });

  it("manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await correrPersonas()).toBe("/login");
  });
});

describe("pagina de documentos /documentos redirige a /recursos (ticket 023)", () => {
  const RUTA = "@/app/(app)/documentos/page";

  it("redirige permanentemente a /recursos", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await destinoDe(RUTA)).toBe("/recursos");
  });
});

describe("pagina de closer", () => {
  it("/mi-dia rechaza a un gerente y lo manda a su vista", async () => {
    auth.mockResolvedValue(sesionGerente);
    // El gerente rechazado aterriza en su primer programa VISIBLE (destinoInicial ->
    // programasVisibles por el alcance del rol, ticket 071).
    programasVisibles.mockResolvedValue([{ id: "p-1", slug: "programa-a", nombre: "Programa A" }]);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/p/programa-a/dashboard");
  });

  it("/mi-dia manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/login");
  });

  it("/mi-dia deja pasar a un closer (ticket 003)", async () => {
    auth.mockResolvedValue(sesionCloser);
    // Un closer con un programa donde vende: la pagina arma su contexto y renderiza.
    programasGestionablesPorUsuario.mockResolvedValue([{ id: "p-1", nombre: "Programa A" }]);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBeNull();
  });

  it("/mi-dia deja pasar a un developer (acceso total, ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    // Un developer no es miembro de ningun programa, pero ve la union: la pagina le
    // pide los programas con la proyeccion de gerente, no con la de closer.
    programasGestionablesPorUsuario.mockResolvedValue([{ id: "p-1", nombre: "Programa A" }]);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBeNull();
  });

  it("/mi-dia niega el registro a un developer en vista 'gerente' (ADR 0003 recuperado, ticket 028)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("gerente");
    // En vista gerente, `paginaConRol("closer")` lo estrecha a gerente y lo rechaza,
    // igual que a un gerente de verdad: aterriza en su primer programa VISIBLE.
    programasVisibles.mockResolvedValue([{ id: "p-1", slug: "programa-a", nombre: "Programa A" }]);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/p/programa-a/dashboard");
  });

  it("/mi-dia deja pasar a un developer en vista 'closer'", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("closer");
    // En vista closer se proyecta como closer: acotado a sus programas por membresia.
    programasGestionablesPorUsuario.mockResolvedValue([]);
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBeNull();
  });
});

/**
 * `/nerd-stats` es la PRIMERA ruta exclusiva del developer (ticket 025, ADR 0025).
 * Hasta aqui la excepcion solo se habia probado por el lado permisivo (el developer
 * entra donde entran otros); esto prueba el lado restrictivo: gerente y closer, que
 * entre ellos son disjuntos, quedan los DOS afuera de la misma ruta.
 */
describe("pagina de developer /nerd-stats (ticket 025)", () => {
  const RUTA = "@/app/(app)/nerd-stats/page";

  it("deja pasar a un developer", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    expect(await destinoDe(RUTA)).toBeNull();
  });

  it("rechaza a un gerente y lo manda a su primer programa", async () => {
    auth.mockResolvedValue(sesionGerente);
    programasVisibles.mockResolvedValue([{ id: "p-1", slug: "programa-a", nombre: "Programa A" }]);
    expect(await destinoDe(RUTA)).toBe("/p/programa-a/dashboard");
  });

  it("rechaza a un closer y lo manda a su vista", async () => {
    auth.mockResolvedValue(sesionCloser);
    expect(await destinoDe(RUTA)).toBe("/mi-dia");
  });

  it("manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await destinoDe(RUTA)).toBe("/login");
  });
});

describe("token vaciado", () => {
  it("una sesion sin id no entra a una pagina de gerente", async () => {
    // Es lo que deja el callback jwt cuando el usuario fue desactivado (S-02/S-03).
    auth.mockResolvedValue({ user: { id: "", email: "x@y.co", rol: null, closerId: null } });
    expect(await destinoDe("@/app/(app)/ajustes/page")).toBe("/login");
  });
});

/** Una ficha minima, suficiente para que la pagina renderice en los tests. */
const FICHA_VACIA = {
  id: "3f8a1c2e-0000-4000-8000-000000000001",
  programId: "p-1",
  nombre: "Lead de Prueba",
  email: "lead@correo.co",
  telefono: null,
  empresa: null,
  cargo: null,
  ciudad: null,
  pais: null,
  entrada: "formulario",
  calificacion: null,
  leadQuality: null,
  leadValue: null,
  numAplicaciones: 1,
  fechaPrimeraAplicacion: null,
  fechaUltimaAplicacion: null,
  creadoEn: new Date("2026-09-01T12:00:00Z"),
  unidoPorTelefono: false,
  soloParciales: false,
  envios: [],
  contactos: [],
  deals: [],
};

/**
 * `/personas/[id]` (ticket 006, 073): ya no pinta nada, redirige a la ficha del lead dentro
 * de su programa. La guarda corre ANTES de mirar el id: sin sesion va al login aunque el id
 * sea basura, sin filtrar que ids existen. Un lead fuera del alcance es 404, igual que uno
 * inexistente: la redireccion nunca revela su programa.
 */
async function correrPersona(id: string): Promise<string> {
  const modulo = (await import(/* @vite-ignore */ "@/app/(app)/personas/[id]/page")) as {
    default: (props: { params: Promise<{ id: string }> }) => Promise<unknown>;
  };
  try {
    await modulo.default({ params: Promise.resolve({ id }) });
    return "paso";
  } catch (e) {
    if (e instanceof NoEncontrado) return "notFound";
    if (e instanceof Redireccion) return e.destino;
    throw e;
  }
}

describe("/personas/[id] redirige a la ficha del lead (ticket 073)", () => {
  const ID = "3f8a1c2e-0000-4000-8000-000000000001";

  it.each([sesionGerente, sesionCloser, sesionDeveloper])("lleva a la ficha dentro del programa", async (sesion) => {
    auth.mockResolvedValue(sesion);
    expect(await correrPersona(ID)).toBe(`/p/programa-a/leads/${ID}`);
  });

  it("manda al login a quien no tiene sesion, sin mirar el id", async () => {
    auth.mockResolvedValue(null);
    expect(await correrPersona(ID)).toBe("/login");
    expect(slugDelLeadVisible).not.toHaveBeenCalled();
  });

  it("un lead inexistente o fuera del alcance es 404", async () => {
    auth.mockResolvedValue(sesionCloser);
    slugDelLeadVisible.mockResolvedValue(null);
    expect(await correrPersona(ID)).toBe("notFound");
  });

  it("un id que no es uuid es 404 y nunca llega a la base", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrPersona("lead@correo.co")).toBe("notFound");
    expect(slugDelLeadVisible).not.toHaveBeenCalled();
  });
});

describe("la ficha del lead /p/[programa]/leads/[id] (ticket 073)", () => {
  const ID = "3f8a1c2e-0000-4000-8000-000000000001";
  async function abrir(id = ID) {
    const { default: pagina } = await import("@/app/(app)/p/[programa]/leads/[id]/page");
    return pagina({ params: Promise.resolve({ programa: "programa-a", id }) });
  }

  it("sin sesión no consulta ni revela el programa", async () => {
    auth.mockResolvedValue(null);
    await expect(abrir()).rejects.toBeInstanceOf(Redireccion);
    expect(programaVisiblePorSlug).not.toHaveBeenCalled();
    expect(fichaDeLead).not.toHaveBeenCalled();
  });

  it("un programa fuera del alcance es 404 antes de leer el lead", async () => {
    auth.mockResolvedValue(sesionCloser);
    programaVisiblePorSlug.mockResolvedValue(null);
    await expect(abrir()).rejects.toBeInstanceOf(NoEncontrado);
    expect(fichaDeLead).not.toHaveBeenCalled();
  });

  it.each([sesionGerente, sesionCloser, sesionDeveloper])("cada rol abre la ficha de su programa", async (sesion) => {
    auth.mockResolvedValue(sesion);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: "programa-a", nombre: "Programa A" });
    await expect(abrir()).resolves.toBeTruthy();
    // La consulta recibe el programa de la URL ya validado: un lead de otro programa sale null.
    expect(fichaDeLead).toHaveBeenCalledWith(expect.anything(), "p-1", ID);
  });

  it("un lead de otro programa o inexistente es 404", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: "programa-a", nombre: "Programa A" });
    fichaDeLead.mockResolvedValue(null);
    await expect(abrir()).rejects.toBeInstanceOf(NoEncontrado);
  });

  it("un id que no es uuid es 404 y nunca llega a la base", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", slug: "programa-a", nombre: "Programa A" });
    await expect(abrir("lead@correo.co")).rejects.toBeInstanceOf(NoEncontrado);
    expect(fichaDeLead).not.toHaveBeenCalled();
  });
});

describe("la lista de una cifra respeta la frontera del dashboard (137)", () => {
  async function abrir(busqueda: Record<string, string | string[]> = { metrica: "agendas" }) {
    const { default: pagina } = await import("@/app/(app)/p/[programa]/dashboard/lista/page");
    return pagina({ params: Promise.resolve({ programa: "programa-a" }), searchParams: Promise.resolve(busqueda) });
  }

  beforeEach(() => {
    vistaDeLista.mockReset();
    vistaDeLista.mockResolvedValue({
      lista: { filas: [], disponible: true, subtotal: { cantidad: 0, caja: [] } },
      periodo: VISTA_VACIA.periodo,
      closerId: null,
    });
  });

  it("sin sesión no consulta ni revela el programa", async () => {
    auth.mockResolvedValue(null);
    await expect(abrir()).rejects.toBeInstanceOf(Redireccion);
    expect(programaVisiblePorSlug).not.toHaveBeenCalled();
    expect(vistaDeLista).not.toHaveBeenCalled();
  });

  it("un programa ajeno devuelve 404 antes de consultar filas", async () => {
    auth.mockResolvedValue(sesionCloser);
    programaVisiblePorSlug.mockResolvedValue(null);
    await expect(abrir()).rejects.toBeInstanceOf(NoEncontrado);
    expect(vistaDeLista).not.toHaveBeenCalled();
  });

  it.each([sesionGerente, sesionCloser, sesionDeveloper])("permite a cada rol dentro de su alcance", async (sesion) => {
    auth.mockResolvedValue(sesion);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", nombre: "Programa A" });
    await expect(abrir({ metrica: "shows", periodo: "ayer", pagina: "2" })).resolves.toBeTruthy();
    expect(vistaDeLista).toHaveBeenCalledWith(expect.objectContaining({ programId: "p-1", metrica: "shows", pagina: 2 }));
  });

  it.each<Record<string, string | string[]>>([{ metrica: "inventada" }, { metrica: "caja", pagina: "0" }, { metrica: "caja", closer: "un-nombre" }, { metrica: ["caja", "leads"] }])("rechaza filtros inválidos sin consultar", async (busqueda) => {
    auth.mockResolvedValue(sesionGerente);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", nombre: "Programa A" });
    await expect(abrir(busqueda)).rejects.toBeInstanceOf(NoEncontrado);
    expect(vistaDeLista).not.toHaveBeenCalled();
  });

  it("un código de closer desconocido no ensancha la lista", async () => {
    auth.mockResolvedValue(sesionGerente);
    programaVisiblePorSlug.mockResolvedValue({ id: "p-1", nombre: "Programa A" });
    vistaDeLista.mockResolvedValue(null);
    await expect(abrir({ metrica: "caja", closer: "a".repeat(64) })).rejects.toBeInstanceOf(NoEncontrado);
  });
});
