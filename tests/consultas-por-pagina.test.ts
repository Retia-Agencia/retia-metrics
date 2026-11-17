import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { abrirSolicitud } from "./helpers/memoria-por-solicitud";
import { programasVisibles, type ProgramaVisible } from "@/lib/auth/alcance";
import { programs, sources, leads, miembrosPrograma, users, deals, oauthClientes } from "@/lib/db/schema";
import { medir, type ResumenDeCosto } from "@/lib/db/medidor";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { Db } from "@/lib/db/tipos";
import { cargarDatosDeMiEspacio } from "@/lib/mi-espacio/cargar-datos";
import { SECCIONES } from "@/lib/mi-espacio/secciones";
import { cargarDatosDeHub, type SeccionDelHubDeTodos } from "@/lib/queries/hub-todos";
import { cargarDatosDeCatalogos } from "@/lib/ajustes/catalogos/cargar-datos";
import { cargarDatosDeMigracion } from "@/lib/ajustes/migracion/cargar-datos";
import { cargarDatosDeSalud } from "@/lib/ajustes/salud/cargar-datos";
import { cargarDatosDeUsuarios } from "@/lib/ajustes/usuarios/cargar-datos";
import { cargarDatosDeListaDelHub } from "@/lib/hub-todos/lista/cargar-datos";
import { cargarDatosDeReporteDelHub } from "@/lib/hub-todos/reporte/cargar-datos";
import { cargarDatosDeMedia } from "@/lib/media/cargar-datos";
import { cargarDatosDeBitacora } from "@/lib/nerd-stats/bitacora/cargar-datos";
import { cargarDatosDeNerdStats } from "@/lib/nerd-stats/cargar-datos";
import { cargarDatosDeCalls } from "@/lib/calls/cargar-datos";
import { cargarDatosDeDeals } from "@/lib/deals/cargar-datos";
import { cargarDatosDeFichaDeDeal } from "@/lib/deals/ficha/cargar-datos";
import { cargarDatosDeInbox } from "@/lib/inbox/cargar-datos";
import { cargarDatosDeLeads } from "@/lib/leads/cargar-datos";
import { cargarDatosDeFichaDeLead } from "@/lib/leads/ficha/cargar-datos";
import { cargarDatosDeProximaCohorte } from "@/lib/proxima-cohorte/cargar-datos";
import { cargarDatosDeRecursos } from "@/lib/recursos/cargar-datos";
import { cargarDatosDeRedireccionARecursos } from "@/lib/recursos/redireccion/cargar-datos";
import { cargarDatosDeStudents } from "@/lib/students/cargar-datos";
import { cargarDatosDeAutorizacion } from "@/lib/oauth/cargar-datos-de-autorizacion";
import { cargarDatosDePrograma } from "@/lib/programa/cargar-datos";
import { cargarDatosDeListaDelPrograma } from "@/lib/hub-programa/lista/cargar-datos";
import {
  cargarDatosDelHubDelPrograma,
  type SeccionDelHubDelPrograma,
} from "@/lib/hub-programa/cargar-datos";
import { resolverPeriodo } from "@/lib/periodo";
import { resolverContextoDeVista, type EntradaDeVista } from "@/lib/queries/vista-dashboard";
import { armarReporteDiario } from "@/lib/queries/reporte-diario";
import { ventanaRitmoDeUrl } from "@/lib/queries/proyeccion";
import { rutaDePrograma } from "@/lib/nav";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

// La memoria por solicitud ACTIVA sobre PGlite (en producción la decide `cache` de React).
vi.mock("@/lib/db/por-solicitud", async (importActual) =>
  (await import("./helpers/memoria-por-solicitud")).moduloConMemoria(importActual));

const HOY = "2026-11-15";

interface Sembrado {
  programas: ProgramaVisible[];
  closerId: string;
  leadId: string;
  dealId: string;
}

function sesionCloser(sembrado: Sembrado): Session {
  return { user: { id: sembrado.closerId, email: "closer-paginas@retia.test", name: "Closer paginas", rol: "closer", operaComoCloser: true, closerId: "Closer paginas", alcanceLimitado: true } } as Session;
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

function datosDelHubDelPrograma(seccion: SeccionDelHubDelPrograma) {
  return async (db: Db, sembrado: Sembrado) => {
    const programa = sembrado.programas[0]!;
    const esHoy = seccion === "hoy";
    const busqueda = esHoy ? {} : { seccion };
    const base = rutaDePrograma(programa.slug, "hub");
    const origen = origenDeLaPagina(base, busqueda);
    const entradaDeVista: EntradaDeVista = esHoy
      ? { programId: programa.id, hoy: HOY, periodo: { preset: "hoy" }, preset: "hoy", claveCloser: null }
      : {
          programId: programa.id,
          hoy: HOY,
          periodo: { preset: "este_mes" },
          filtroDeCohorte: { parametro: undefined },
          preset: "hoy",
          claveCloser: null,
        };
    const contextoPendiente = resolverContextoDeVista(entradaDeVista, db);
    const ventanaRitmo = ventanaRitmoDeUrl(undefined);
    const reporteDeHoy = esHoy
      ? armarReporteDiario({ programId: programa.id, dia: HOY, ventanaRitmo, contexto: contextoPendiente }, db)
      : null;
    const contexto = await contextoPendiente;
    const datos = await cargarDatosDelHubDelPrograma(db, {
      programa,
      rol: "developer",
      busqueda,
      seccion,
      hoy: HOY,
      diaDelReporte: HOY,
      hoyDeLaPestana: HOY,
      ventanaRitmo,
      entradaDeVista,
      contexto,
      reporteDeHoy,
      origen,
      configurar: { hrefBase: `/p/${programa.slug}/programa?seccion=ventas`, origen },
    });
    if (datos.seccion === "dinero") await datos.seriesDeDinero;
    return datos;
  };
}

// Topes del escenario de ESTE test (3 programas sembrados), medidos en el CI. No son comparables con la
// tabla del 437 (dev:local, datos reales). El tope es EXACTO: si una página usa menos, el guardián falla
// con el número nuevo, y se baja en el mismo commit (el trinquete nunca queda holgado).
const PAGINAS = {
  "/hub": { pagina: "app/(app)/hub/page.tsx", tope: 179, escalaConProgramas: true, cargar: datosDelHub("hoy") },
  "/hub?seccion=comercial": { pagina: "app/(app)/hub/page.tsx", tope: 260, escalaConProgramas: true, cargar: datosDelHub("comercial") },
  "/hub?seccion=pauta": { pagina: "app/(app)/hub/page.tsx", tope: 219, escalaConProgramas: true, cargar: datosDelHub("pauta") },
  "/hub?seccion=dinero": { pagina: "app/(app)/hub/page.tsx", tope: 167, escalaConProgramas: true, cargar: datosDelHub("dinero") },
  "/p/[programa]/hub": { pagina: "app/(app)/p/[programa]/hub/page.tsx", tope: 999, escalaConProgramas: false, cargar: datosDelHubDelPrograma("hoy") },
  "/p/[programa]/hub?seccion=comercial": { pagina: "app/(app)/p/[programa]/hub/page.tsx", tope: 999, escalaConProgramas: false, cargar: datosDelHubDelPrograma("comercial") },
  "/p/[programa]/hub?seccion=pauta": { pagina: "app/(app)/p/[programa]/hub/page.tsx", tope: 999, escalaConProgramas: false, cargar: datosDelHubDelPrograma("pauta") },
  "/p/[programa]/hub?seccion=dinero": { pagina: "app/(app)/p/[programa]/hub/page.tsx", tope: 999, escalaConProgramas: false, cargar: datosDelHubDelPrograma("dinero") },
  "/mi-espacio (closer)": {
    pagina: "app/(app)/mi-espacio/page.tsx",
    tope: 31, // 18 antes de la fase 2: la siembra ahora incluye un deal. Costo fijo, probado: con 4 deals de más da lo mismo (test de abajo)
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
  "/ajustes/catalogos": { pagina: "app/(app)/ajustes/catalogos/page.tsx", tope: 4, escalaConProgramas: false, cargar: (db) => cargarDatosDeCatalogos(db) },
  "/ajustes/migracion": { pagina: "app/(app)/ajustes/migracion/page.tsx", tope: 3, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeMigracion(db, { slugPedido: s.programas[0]!.slug }) },
  "/ajustes/salud": { pagina: "app/(app)/ajustes/salud/page.tsx", tope: 23, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeSalud(db, { slugPedido: s.programas[0]!.slug, hoy: HOY, ahora: new Date(`${HOY}T12:00:00-05:00`), fetchCalendly: async () => new Response("{}") }) },
  "/ajustes/usuarios": { pagina: "app/(app)/ajustes/usuarios/page.tsx", tope: 7, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeUsuarios(db, { userId: s.closerId, rol: "developer" }) },
  "/hub/lista": { pagina: "app/(app)/hub/lista/page.tsx", tope: 6, escalaConProgramas: true, cargar: (db, s) => cargarDatosDeListaDelHub(db, { programas: s.programas, metrica: "leads", periodo: resolverPeriodo({ preset: "este_mes" }, { hoy: HOY }), hoy: HOY, pagina: 1 }) },
  "/hub/reporte": { pagina: "app/(app)/hub/reporte/page.tsx", tope: 139, escalaConProgramas: true, cargar: (db, s) => cargarDatosDeReporteDelHub(db, { programas: s.programas, dia: HOY, puedeVerEquipo: true }) },
  "/media": { pagina: "app/(app)/media/page.tsx", tope: 3, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeMedia(db, { userId: s.closerId, rol: "developer", pedido: {}, hoy: HOY }) },
  "/nerd-stats/bitacora": { pagina: "app/(app)/nerd-stats/bitacora/page.tsx", tope: 6, escalaConProgramas: false, cargar: (db) => cargarDatosDeBitacora(db, { busqueda: {} }) },
  "/nerd-stats": { pagina: "app/(app)/nerd-stats/page.tsx", tope: 17, escalaConProgramas: false, cargar: (db) => cargarDatosDeNerdStats(db) },
  "/recursos": { pagina: "app/(app)/recursos/page.tsx", tope: 1, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeRedireccionARecursos(db, { userId: s.closerId, rol: "closer" }) },
  "/oauth/autorizar": { pagina: "app/oauth/autorizar/page.tsx", tope: 1, escalaConProgramas: false, cargar: (db) => cargarDatosDeAutorizacion(db, { params: { client_id: "https://cliente.paginas.test/cimd", redirect_uri: "https://cliente.paginas.test/callback", response_type: "code", code_challenge_method: "S256", code_challenge: "a".repeat(43) } }) },
  "/p/[programa]/calls": { pagina: "app/(app)/p/[programa]/calls/page.tsx", tope: 9, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeCalls(db, { session: sesionCloser(s), programId: s.programas[0]!.id, busqueda: {} }) },
  "/p/[programa]/deals": { pagina: "app/(app)/p/[programa]/deals/page.tsx", tope: 21, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeDeals(db, { session: sesionCloser(s), programId: s.programas[0]!.id, busqueda: {}, vistaRecordada: null }) },
  "/p/[programa]/deals/[id]": { pagina: "app/(app)/p/[programa]/deals/[id]/page.tsx", tope: 48, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeFichaDeDeal(db, { session: sesionCloser(s), programId: s.programas[0]!.id, dealId: s.dealId, rol: "closer" }) },
  "/p/[programa]/inbox": { pagina: "app/(app)/p/[programa]/inbox/page.tsx", tope: 21, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeInbox(db, { session: sesionCloser(s), programId: s.programas[0]!.id, rol: "closer" }) },
  "/p/[programa]/hub/lista": { pagina: "app/(app)/p/[programa]/hub/lista/page.tsx", tope: 3, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeListaDelPrograma(db, { programId: s.programas[0]!.id, metrica: "leads", busqueda: { preset: "este_mes" }, hoy: HOY, pagina: 1, ahora: new Date(`${HOY}T12:00:00-05:00`) }) },
  "/p/[programa]/leads": { pagina: "app/(app)/p/[programa]/leads/page.tsx", tope: 10, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeLeads(db, { programId: s.programas[0]!.id, busqueda: {}, pagina: 0, paginaDuplicados: 0, duenoUserId: s.closerId }) },
  "/p/[programa]/leads/[id]": { pagina: "app/(app)/p/[programa]/leads/[id]/page.tsx", tope: 9, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeFichaDeLead(db, { programId: s.programas[0]!.id, leadId: s.leadId, userId: s.closerId, rol: "closer", operaComoCloser: true }) },
  "/p/[programa]/programa": { pagina: "app/(app)/p/[programa]/programa/page.tsx", tope: 30, escalaConProgramas: false, cargar: (db, s) => cargarDatosDePrograma(db, { visibleId: s.programas[0]!.id, userId: s.closerId, rol: "developer", busqueda: {}, hoy: HOY, origen: "https://retia.test", ahora: new Date(`${HOY}T12:00:00-05:00`), cargarCuentasDisponibles: async () => [] }) },
  "/p/[programa]/proxima-cohorte": { pagina: "app/(app)/p/[programa]/proxima-cohorte/page.tsx", tope: 2, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeProximaCohorte(db, { programId: s.programas[0]!.id, busqueda: {} }) },
  "/p/[programa]/recursos": { pagina: "app/(app)/p/[programa]/recursos/page.tsx", tope: 3, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeRecursos(db, { programId: s.programas[0]!.id, userId: s.closerId, consultarGestionables: true }) },
  "/p/[programa]/students": { pagina: "app/(app)/p/[programa]/students/page.tsx", tope: 2, escalaConProgramas: false, cargar: (db, s) => cargarDatosDeStudents(db, { programId: s.programas[0]!.id, busqueda: {} }) },
} satisfies Record<string, Pagina>;

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

async function sembrar(db: Db, cantidadDeProgramas: number, dealsExtra = 0): Promise<Sembrado> {
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
  const leadsSembrados = await db.insert(leads).values(programas.flatMap((programa, programaIndice) =>
    Array.from({ length: 2 }, (_, leadIndice) => ({
      programId: programa.id,
      emailNormalizado: `persona-${programaIndice + 1}-${leadIndice + 1}@paginas.test`,
      fechaPrimeraAplicacion: new Date(`2026-11-0${leadIndice + 1}T12:00:00-05:00`),
    })),
  )).returning();
  const [deal] = await db.insert(deals).values({
    programId: programas[0]!.id,
    leadId: leadsSembrados[0]!.id,
    ownerUserId: closer!.id,
    etapa: "contactado",
  }).returning();
  // Filas de más en el programa del closer: el costo de una página no puede crecer con ellas (N+1).
  if (dealsExtra > 0) {
    const leadsExtra = await db.insert(leads).values(Array.from({ length: dealsExtra }, (_, indice) => ({
      programId: programas[0]!.id,
      emailNormalizado: `extra-${indice + 1}@paginas.test`,
      fechaPrimeraAplicacion: new Date(`2026-11-1${indice % 5}T12:00:00-05:00`),
    }))).returning();
    await db.insert(deals).values(leadsExtra.map((lead, indice) => ({
      programId: programas[0]!.id,
      leadId: lead.id,
      ownerUserId: closer!.id,
      etapa: (["contactado", "agendado"] as const)[indice % 2]!,
    })));
  }
  await db.insert(oauthClientes).values({
    clientId: "https://cliente.paginas.test/cimd",
    nombre: "Cliente paginas",
    redirectUris: ["https://cliente.paginas.test/callback"],
  });
  return {
    programas: programas.map(({ id, slug, nombre }) => ({ id, slug, nombre })),
    closerId: closer!.id,
    leadId: leadsSembrados[0]!.id,
    dealId: deal!.id,
  };
}

function fallasDelGuardian(costo: ResumenDeCosto, tope: number): string[] {
  return [
    ...(costo.identicas === 0 ? [] : [`consultas identicas: ${costo.identicas}`]),
    ...(costo.consultas <= tope ? [] : [`tope excedido: ${costo.consultas} > ${tope}`]),
    // El tope solo baja: si la página ya usa menos, el trinquete se aprieta en el mismo commit.
    ...(costo.consultas >= tope ? [] : [`tope holgado: baja el tope de ${tope} a ${costo.consultas}`]),
  ];
}

async function medirPagina(nombre: string, pagina: Pagina, cantidad: number, dealsExtra = 0) {
  await base.vaciar();
  const sembrado = await sembrar(base.db, cantidad, dealsExtra);
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

  // N+1 por filas: con 4 deals de más en el programa, ninguna página pide una consulta más por cada uno.
  it.each(Object.entries(PAGINAS))("%s no crece con las filas del programa", async (nombre, pagina) => {
    const base3 = await medirPagina(nombre, pagina, 3);
    const conFilas = await medirPagina(nombre, pagina, 3, 4);
    expect(conFilas.costo.consultas, `${nombre}: ${base3.costo.consultas} sin filas extra, ${conFilas.costo.consultas} con 4 deals más`)
      .toBe(base3.costo.consultas);
    expect(conFilas.costo.identicas).toBe(0);
  });

  it("mantiene todas las paginas en un grupo del trinquete", () => {
    const cubiertas = new Set(Object.values(PAGINAS).map((pagina) => pagina.pagina));
    const clasificadas = new Set([...cubiertas, ...SIN_CONSULTAS]);
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
