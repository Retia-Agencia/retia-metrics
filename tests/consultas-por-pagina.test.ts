import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { abrirSolicitud } from "./helpers/memoria-por-solicitud";
import { programasVisibles, type ProgramaVisible } from "@/lib/auth/alcance";
import { programs, sources, leads, miembrosPrograma, users } from "@/lib/db/schema";
import { medir, type ResumenDeCosto } from "@/lib/db/medidor";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { Db } from "@/lib/db/tipos";
import { cargarDatosDeMiEspacio } from "@/lib/mi-espacio/cargar-datos";
import { SECCIONES } from "@/lib/mi-espacio/secciones";
import { cargarDatosDeHub, type SeccionDelHubDeTodos } from "@/lib/queries/hub-todos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

// La memoria por solicitud ACTIVA sobre PGlite (en producción la decide `cache` de React).
vi.mock("@/lib/db/por-solicitud", async (importActual) =>
  (await import("./helpers/memoria-por-solicitud")).moduloConMemoria(importActual));

const HOY = "2026-11-15";

interface Sembrado {
  programas: ProgramaVisible[];
  closerId: string;
}

interface Pagina {
  pagina: string;
  tope: number;
  escalaConProgramas: boolean;
  cargar: (db: Db, sembrado: Sembrado) => Promise<unknown>;
}

function datosDelHub(seccion: SeccionDelHubDeTodos) {
  return (db: Db, sembrado: Sembrado) => cargarDatosDeHub(db, {
    programas: sembrado.programas,
    hoy: HOY,
    periodo: { preset: "este_mes" },
    origen: "/hub",
    seccion,
    diaDelReporte: HOY,
    conListas: true,
  });
}

// Topes del escenario de ESTE test (3 programas sembrados), medidos en el CI. No son comparables con la
// tabla del 437 (dev:local, datos reales). El tope es EXACTO: si una página usa menos, el guardián falla
// con el número nuevo, y se baja en el mismo commit (el trinquete nunca queda holgado).
const PAGINAS = {
  "/hub": { pagina: "app/(app)/hub/page.tsx", tope: 179, escalaConProgramas: true, cargar: datosDelHub("hoy") },
  "/hub?seccion=comercial": { pagina: "app/(app)/hub/page.tsx", tope: 260, escalaConProgramas: true, cargar: datosDelHub("comercial") },
  "/hub?seccion=pauta": { pagina: "app/(app)/hub/page.tsx", tope: 219, escalaConProgramas: true, cargar: datosDelHub("pauta") },
  "/hub?seccion=dinero": { pagina: "app/(app)/hub/page.tsx", tope: 167, escalaConProgramas: true, cargar: datosDelHub("dinero") },
  "/mi-espacio (closer)": {
    pagina: "app/(app)/mi-espacio/page.tsx",
    tope: 18,
    escalaConProgramas: false,
    cargar: (db, sembrado) => cargarDatosDeMiEspacio(db, {
      userId: sembrado.closerId,
      rol: "closer",
      puedeTrabajar: true,
      puedeConectarIa: true,
      puedeCrearToken: true,
      cargarProgramasVisibles: false,
      seccion: SECCIONES.find((seccion) => seccion.id === "notificaciones")!,
      programaPedido: undefined,
      programaPreferido: null,
      busqueda: {},
      hoy: HOY,
      origen: "/mi-espacio",
    }),
  },
} satisfies Record<string, Pagina>;

// Paginas del estudio §13.3 aun no cubiertas; la fase 2 vacia esta lista.
const PENDIENTES_447 = [
  "app/(app)/ajustes/catalogos/page.tsx",
  "app/(app)/ajustes/migracion/page.tsx",
  "app/(app)/ajustes/salud/page.tsx",
  "app/(app)/ajustes/usuarios/page.tsx",
  "app/(app)/hub/lista/page.tsx",
  "app/(app)/hub/reporte/page.tsx",
  "app/(app)/media/page.tsx",
  "app/(app)/nerd-stats/bitacora/page.tsx",
  "app/(app)/nerd-stats/page.tsx",
  "app/(app)/p/[programa]/calls/page.tsx",
  "app/(app)/p/[programa]/deals/[id]/page.tsx",
  "app/(app)/p/[programa]/deals/page.tsx",
  "app/(app)/p/[programa]/hub/lista/page.tsx",
  "app/(app)/p/[programa]/hub/page.tsx",
  "app/(app)/p/[programa]/inbox/page.tsx",
  "app/(app)/p/[programa]/leads/[id]/page.tsx",
  "app/(app)/p/[programa]/leads/page.tsx",
  "app/(app)/p/[programa]/programa/page.tsx",
  "app/(app)/p/[programa]/proxima-cohorte/page.tsx",
  "app/(app)/p/[programa]/recursos/page.tsx",
  "app/(app)/p/[programa]/students/page.tsx",
  "app/(app)/recursos/page.tsx",
  "app/oauth/autorizar/page.tsx",
] as const;

const SIN_CONSULTAS = [
  "app/page.tsx",
  "app/login/page.tsx",
  "app/(app)/mi-dia/page.tsx",
  "app/(app)/perfil/page.tsx",
  "app/(app)/ajustes/page.tsx",
  "app/(app)/ajustes/canales/page.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/dashboard/lista/page.tsx",
  "app/(app)/p/[programa]/dashboard/page.tsx",
  "app/(app)/p/[programa]/dashboard/lista/page.tsx",
  "app/(app)/p/[programa]/metas/page.tsx",
  "app/(app)/p/[programa]/page.tsx",
] as const;

let base: Awaited<ReturnType<typeof crearBaseReutilizable>>;

async function sembrar(db: Db, cantidadDeProgramas: number): Promise<Sembrado> {
  const programas = await db.insert(programs).values(Array.from({ length: cantidadDeProgramas }, (_, indice) => ({
    ...PROGRAMA_DE_PRUEBA,
    slug: `pagina-${indice + 1}`,
    nombre: `Pagina ${indice + 1}`,
    ticketUsd: "1000.00",
  }))).returning();
  const [closer] = await db.insert(users).values({
    email: "closer-paginas@retia.test", nombre: "Closer paginas", rol: "closer", closerId: "Closer paginas",
  }).returning();
  await db.insert(miembrosPrograma).values({ userId: closer!.id, programId: programas[0]!.id });
  await db.insert(sources).values(programas.flatMap((programa, programaIndice) =>
    Array.from({ length: 3 }, (_, fuenteIndice) => ({
      programId: programa.id,
      nombre: `Fuente ${programaIndice + 1}-${fuenteIndice + 1}`,
    })),
  ));
  await db.insert(leads).values(programas.flatMap((programa, programaIndice) =>
    Array.from({ length: 2 }, (_, leadIndice) => ({
      programId: programa.id,
      emailNormalizado: `persona-${programaIndice + 1}-${leadIndice + 1}@paginas.test`,
      fechaPrimeraAplicacion: new Date(`2026-11-0${leadIndice + 1}T12:00:00-05:00`),
    })),
  ));
  return { programas: programas.map(({ id, slug, nombre }) => ({ id, slug, nombre })), closerId: closer!.id };
}

function fallasDelGuardian(costo: ResumenDeCosto, tope: number): string[] {
  return [
    ...(costo.identicas === 0 ? [] : [`consultas identicas: ${costo.identicas}`]),
    ...(costo.consultas <= tope ? [] : [`tope excedido: ${costo.consultas} > ${tope}`]),
    // El tope solo baja: si la página ya usa menos, el trinquete se aprieta en el mismo commit.
    ...(costo.consultas >= tope ? [] : [`tope holgado: baja el tope de ${tope} a ${costo.consultas}`]),
  ];
}

async function medirPagina(nombre: string, pagina: Pagina, cantidad: number) {
  await base.vaciar();
  const sembrado = await sembrar(base.db, cantidad);
  abrirSolicitud();
  const { costo, identicas } = await medir(nombre, () => pagina.cargar(base.db, sembrado));
  // Una falla dice CUÁL consulta se repitió, para encontrar su dueño sin medir a mano.
  const cuales = identicas.slice(0, 5).map(({ sentencia, veces }) => `  ×${veces + 1} ${sentencia.slice(0, 160)}`);
  return { costo, fallas: [...fallasDelGuardian(costo, pagina.tope), ...cuales] };
}

function paginasEn(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    return entrada.isDirectory() ? paginasEn(ruta) : entrada.name === "page.tsx" ? [relative(process.cwd(), ruta)] : [];
  });
}

beforeAll(async () => {
  base = await crearBaseReutilizable();
});

afterAll(async () => {
  await base.cerrar();
});

describe("consultas por pagina", () => {
  it.each(Object.entries(PAGINAS))("%s respeta su presupuesto", async (nombre, pagina) => {
    const conTres = await medirPagina(nombre, pagina, 3);
    const conSeis = await medirPagina(nombre, pagina, 6);
    expect(conTres.fallas).toEqual([]);
    expect(conSeis.costo.identicas).toBe(0);
    if (pagina.escalaConProgramas) {
      expect(conSeis.costo.consultas).toBeGreaterThan(conTres.costo.consultas);
    } else {
      expect(conSeis.costo.consultas).toBeLessThanOrEqual(pagina.tope);
      expect(conSeis.costo.consultas).toBe(conTres.costo.consultas);
    }
  });

  it("mantiene todas las paginas en un grupo del trinquete", () => {
    const cubiertas = new Set(Object.values(PAGINAS).map((pagina) => pagina.pagina));
    const clasificadas = new Set([...cubiertas, ...PENDIENTES_447, ...SIN_CONSULTAS]);
    const actuales = paginasEn(join(process.cwd(), "app"));
    expect(actuales.filter((pagina) => !clasificadas.has(pagina))).toEqual([]);
    expect([...clasificadas].filter((pagina) => !actuales.includes(pagina))).toEqual([]);
  });
});

describe("el guardian muerde", () => {
  async function costoDe(loader: (db: Db, sembrado: Sembrado) => Promise<unknown>) {
    const pagina: Pagina = { pagina: "sintetica", tope: 99, escalaConProgramas: false, cargar: loader };
    return medirPagina("/sintetica", pagina, 3);
  }

  const lecturaReal = (db: Db, sembrado: Sembrado) => programasVisibles(sembrado.closerId, "closer", db);

  it.each([
    ["dos valores de ahora", async (db: Db, s: Sembrado) => Promise.all([
      unaVezPorSolicitud(db, claveDe("mala-ahora", new Date("2026-11-15T12:00:00-05:00")), () => lecturaReal(db, s)),
      unaVezPorSolicitud(db, claveDe("mala-ahora", new Date("2026-11-15T12:00:01-05:00")), () => lecturaReal(db, s)),
    ])],
    ["un campo que no decide", async (db: Db, s: Sembrado) => Promise.all([
      unaVezPorSolicitud(db, claveDe("mala-slug", s.programas[0]!.id, "uno"), () => lecturaReal(db, s)),
      unaVezPorSolicitud(db, claveDe("mala-slug", s.programas[0]!.id, "dos"), () => lecturaReal(db, s)),
    ])],
    ["dos formas de un vacio", async (db: Db, s: Sembrado) => Promise.all([
      unaVezPorSolicitud(db, claveDe("mal-vacio", ""), () => lecturaReal(db, s)),
      unaVezPorSolicitud(db, claveDe("mal-vacio", undefined), () => lecturaReal(db, s)),
    ])],
    ["una lectura global por programa", async (db: Db, s: Sembrado) => Promise.all(s.programas.map((programa) =>
      unaVezPorSolicitud(db, claveDe("mal-global", programa.id), () => lecturaReal(db, s)),
    ))],
  ] as const)("detecta %s", async (_nombre, loader) => {
    const resultado = await costoDe(loader);
    expect(resultado.fallas.some((falla) => falla.startsWith("consultas identicas:"))).toBe(true);
    expect(resultado.costo.identicas).toBeGreaterThan(0);
  });

  it("acepta las claves que solo contienen lo que decide la lectura", async () => {
    const resultado = await costoDe(async (db, sembrado) => Promise.all([
      unaVezPorSolicitud(db, claveDe("bien", sembrado.closerId), () => lecturaReal(db, sembrado)),
      unaVezPorSolicitud(db, claveDe("bien", sembrado.closerId), () => lecturaReal(db, sembrado)),
    ]));
    // La sintética no tiene tope propio: aquí solo importa que no repita.
    expect(resultado.fallas.filter((falla) => !falla.startsWith("tope holgado"))).toEqual([]);
    expect(resultado.costo.identicas).toBe(0);
  });
});
