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

// El historial de una persona (ticket 006) lee la base; sin base en los tests se
// mockea la query para que las guardas y el 404 sean lo unico bajo prueba.
const historialDePersona = vi.fn();
vi.mock("@/lib/queries/personas", () => ({ historialDePersona }));

// La pagina de recursos (ticket 023) lee la base; sin base en los tests se mockean
// las lecturas para que las guardas sean lo unico bajo prueba.
const recursosVigentes = vi.fn();
const enlacesDePagoVigentes = vi.fn();
const historialDeRecurso = vi.fn();
vi.mock("@/lib/queries/recursos", () => ({
  recursosVigentes,
  enlacesDePagoVigentes,
  historialDeRecurso,
}));

// El dashboard (ticket 005) arma su vista con `armarVistaDelDashboard`; sin base en
// los tests se mockea para poder mirar CON QUE lo llama cada rol.
const armarVistaDelDashboard = vi.fn();
vi.mock("@/lib/queries/vista-dashboard", () => ({ armarVistaDelDashboard }));

// La pagina de cohortes lee las cohortes del programa; sin base en los tests, se
// mockea la lectura para que la guarda sea lo unico bajo prueba.
const listarCohortes = vi.fn();
vi.mock("@/lib/catalogo/cohortes", () => ({ listarCohortes }));

// La pagina de productos (ADR 0016) lee los productos de cada programa; sin base en
// los tests, se mockea la lectura para probar solo las guardas. `/mi-dia` (ticket
// 003) tambien lee `productosActivos` del mismo modulo.
const listarProductos = vi.fn();
const productosActivos = vi.fn();
vi.mock("@/lib/catalogo/productos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogo/productos")>()),
  listarProductos,
  productosActivos,
}));

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
  redirect.mockReset();
  permanentRedirect.mockReset();
  notFound.mockReset();
  programaActivoPorSlug.mockReset();
  programasActivos.mockReset();
  programaPorSlug.mockReset();
  listarCohortes.mockReset();
  listarCohortes.mockResolvedValue([]);
  programasGestionablesPorUsuario.mockReset();
  programasGestionablesPorUsuario.mockResolvedValue([]);
  listarProductos.mockReset();
  listarProductos.mockResolvedValue([]);
  productosActivos.mockReset();
  productosActivos.mockResolvedValue([]);
  listarVacio.mockClear();
  historialDePersona.mockReset();
  historialDePersona.mockResolvedValue(HISTORIAL_VACIO);
  recursosVigentes.mockReset();
  recursosVigentes.mockResolvedValue([]);
  enlacesDePagoVigentes.mockReset();
  enlacesDePagoVigentes.mockResolvedValue([]);
  historialDeRecurso.mockReset();
  historialDeRecurso.mockResolvedValue([]);
  armarVistaDelDashboard.mockReset();
  armarVistaDelDashboard.mockResolvedValue(VISTA_VACIA);
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
  ["/ajustes/catalogos", "@/app/(app)/ajustes/catalogos/page"],
  ["/ajustes/usuarios", "@/app/(app)/ajustes/usuarios/page"],
  ["/ajustes/programas", "@/app/(app)/ajustes/programas/page"],
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
  busqueda: Record<string, string> = {},
): Promise<"paso" | "login" | "midia" | "notFound"> {
  const modulo = (await import(/* @vite-ignore */ RUTA_PROGRAMA)) as {
    default: (props: {
      params: Promise<{ slug: string }>;
      searchParams: Promise<Record<string, string | string[] | undefined>>;
    }) => Promise<unknown>;
  };
  try {
    await modulo.default({
      params: Promise.resolve({ slug }),
      searchParams: Promise.resolve(busqueda),
    });
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

  it("deja pasar a un developer con un slug existente (ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
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

describe("el dashboard no depende del rol (ADR 0009, ticket 005)", () => {
  const SLUG = "programa-a";
  const BUSQUEDA = { rango: "semana", closer: "Ana" };

  beforeEach(() => {
    programaActivoPorSlug.mockResolvedValue({ id: "p-1", slug: SLUG, nombre: "Programa A" });
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

describe("pagina de productos /productos (ADR 0016)", () => {
  const RUTA = "@/app/(app)/productos/page";

  it("deja pasar a un gerente", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await destinoDe(RUTA)).toBeNull();
  });

  it("deja pasar a un closer (ambos roles la administran)", async () => {
    auth.mockResolvedValue(sesionCloser);
    expect(await destinoDe(RUTA)).toBeNull();
  });

  it("deja pasar a un developer (acceso total, ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    expect(await destinoDe(RUTA)).toBeNull();
  });

  it("manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await destinoDe(RUTA)).toBe("/login");
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
    // El gerente rechazado aterriza en su primer programa activo (destinoInicial).
    expect(await destinoDe("@/app/(app)/mi-dia/page")).toBe("/programas/programa-a");
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
    expect(await destinoDe(RUTA)).toBe("/programas/programa-a");
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

/** Un historial minimo, suficiente para que la pagina renderice en los tests. */
const HISTORIAL_VACIO = {
  persona: {
    id: "per-1",
    nombre: "Lead de Prueba",
    emailNormalizado: "lead@correo.co",
    telefono: null,
    programId: "p-1",
    programaNombre: "Programa A",
    responsableCloserId: null,
    entrada: "formulario",
    estado: "cola_setteo",
  },
  llamadas: [],
  ventas: [],
};

/**
 * Historial de una persona `/personas/[id]` (ticket 006). Lo ven gerente y closer,
 * igual que el dashboard del que se entra (ADR 0009). Un id que no existe es 404,
 * y la guarda corre ANTES de mirar el id: sin sesion va al login aunque el id sea
 * basura, sin filtrar que ids existen.
 */
async function correrHistorial(id: string): Promise<"paso" | "login" | "midia" | "notFound"> {
  const modulo = (await import(/* @vite-ignore */ "@/app/(app)/personas/[id]/page")) as {
    default: (props: { params: Promise<{ id: string }> }) => Promise<unknown>;
  };
  try {
    await modulo.default({ params: Promise.resolve({ id }) });
    return "paso";
  } catch (e) {
    if (e instanceof NoEncontrado) return "notFound";
    if (e instanceof Redireccion) return e.destino === "/login" ? "login" : "midia";
    throw e;
  }
}

describe("historial de una persona /personas/[id] (ticket 006)", () => {
  const ID = "3f8a1c2e-0000-4000-8000-000000000001";

  it("deja pasar a un gerente", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrHistorial(ID)).toBe("paso");
  });

  it("deja pasar a un closer (se entra desde el dashboard, ADR 0009)", async () => {
    auth.mockResolvedValue(sesionCloser);
    expect(await correrHistorial(ID)).toBe("paso");
  });

  it("manda al login a quien no tiene sesion", async () => {
    auth.mockResolvedValue(null);
    expect(await correrHistorial(ID)).toBe("login");
  });

  it("una persona que no existe es 404", async () => {
    auth.mockResolvedValue(sesionGerente);
    historialDePersona.mockResolvedValue(null);
    expect(await correrHistorial(ID)).toBe("notFound");
  });

  it("un id que no es uuid es 404 y nunca llega a la base", async () => {
    auth.mockResolvedValue(sesionGerente);
    expect(await correrHistorial("lead@correo.co")).toBe("notFound");
    expect(historialDePersona).not.toHaveBeenCalled();
  });
});
