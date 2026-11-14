import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import {
  abonos,
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  gastoPauta,
  leads,
  miembrosPrograma,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarDeal } from "@/lib/deals/editar-deal";
import { capacidadesMcp } from "@/lib/mcp/herramientas/capacidades";
import { HERRAMIENTAS, type ContextoMcp } from "@/lib/mcp/herramientas";
import type { ResultadoDeHerramienta } from "@/lib/mcp/herramientas/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const PROGRAMA = "evaluaciones-a";
const PERIODO = { periodo: "custom", desde: "2026-11-09", hasta: "2026-11-15" } as const;

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;

interface ContextoDeEvaluacion {
  llamar(nombre: string, entrada: Record<string, unknown>): Promise<ResultadoDeHerramienta>;
}

interface Evaluacion {
  pregunta: string;
  herramientasEsperadas: string[];
  maxLlamadas: number;
  ejecutar(ctx: ContextoDeEvaluacion): Promise<void>;
}

const EVALUACIONES: Evaluacion[] = [
  {
    pregunta: "¿De quién es el lead Alexander?",
    herramientasEsperadas: ["buscar"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("buscar", { texto: "Alexander", campos: ["nombre", "dueno", "ultimo_cambio_de_dueno"] });
      expect(resultado.texto).toContain("dueño Nicolás");
      expect(resultado.texto).toContain("antes Alejo Carvajal");
    },
  },
  {
    pregunta: "Como closer, ¿puedo ceder mi deal a otro closer del programa? (A-177)",
    herramientasEsperadas: [],
    maxLlamadas: 0,
    async ejecutar() {},
  },
  {
    pregunta: "¿Cuántas ventas hizo cada closer esta semana?",
    herramientasEsperadas: ["consultar_hechos"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("consultar_hechos", { programa: PROGRAMA, hecho: "venta", ...PERIODO, agrupar_por: ["dueno"] });
      expect(resultado.estructurado).toMatchObject({ total: 1 });
      expect(JSON.stringify(resultado.estructurado)).toContain("Nicolás");
    },
  },
  {
    pregunta: "¿Qué cartera está vencida en el programa?",
    herramientasEsperadas: ["cartera_vencida"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("cartera_vencida", { programa: PROGRAMA });
      expect(resultado.estructurado).toMatchObject({ total: 1 });
      expect(resultado.texto).toContain("Alexander Ruiz");
    },
  },
  {
    pregunta: "¿Cuál es el ROAS del programa esta semana?",
    herramientasEsperadas: ["pauta_roas"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("pauta_roas", { programa: PROGRAMA, ...PERIODO, nivel: "total" });
      expect(resultado.estructurado).toMatchObject({ ventas: 1 });
      expect(resultado.texto).toContain("ROAS");
    },
  },
  {
    pregunta: "¿Cuántos deals hay por etapa en el tablero?",
    herramientasEsperadas: ["tablero_de_deals"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("tablero_de_deals", { programa: PROGRAMA, cohorte: "todas" });
      expect(resultado.estructurado.tablero).toMatchObject({ total: 1 });
    },
  },
  {
    pregunta: "¿Quién es el dueño del lead alexander@retia.test?",
    herramientasEsperadas: ["buscar"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("buscar", { texto: "alexander@retia.test", programa: PROGRAMA });
      expect(resultado.texto).toContain("dueño Nicolás");
    },
  },
  {
    pregunta: "¿Qué agendas hay el 14 de noviembre?",
    herramientasEsperadas: ["consultar_hechos"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("consultar_hechos", {
        programa: PROGRAMA,
        hecho: "agenda",
        periodo: "custom",
        desde: "2026-11-14",
        hasta: "2026-11-14",
      });
      expect(resultado.estructurado).toMatchObject({ total: 1 });
    },
  },
  {
    pregunta: "¿Cuánta caja entró esta semana, separada por moneda?",
    herramientasEsperadas: ["consultar_hechos"],
    maxLlamadas: 1,
    async ejecutar(ctx) {
      const resultado = await ctx.llamar("consultar_hechos", { programa: PROGRAMA, hecho: "abono", ...PERIODO, agrupar_por: ["moneda"] });
      expect(resultado.estructurado).toMatchObject({ total: 1 });
      expect(JSON.stringify(resultado.estructurado)).toContain("USD");
    },
  },
];

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: PROGRAMA,
    nombre: "Evaluaciones A",
    ticketUsd: "800",
  }).returning();
  const [alejo, nicolas, gerente] = await db.insert(users).values([
    { email: "alejo-evaluaciones@retia.test", nombre: "Alejo Carvajal", rol: "closer", closerId: "alejo-evaluaciones" },
    { email: "nicolas-evaluaciones@retia.test", nombre: "Nicolás", rol: "closer", closerId: "nicolas-evaluaciones" },
    { email: "gerente-evaluaciones@retia.test", nombre: "Mani", rol: "gerente" },
  ]).returning();
  gerenteId = gerente.id;
  await db.insert(miembrosPrograma).values([
    { userId: alejo.id, programId: programa.id },
    { userId: nicolas.id, programId: programa.id },
  ]);
  const [cohorte] = await db.insert(cohorts).values({
    programId: programa.id,
    codigo: "E-11",
    metaCupos: 10,
    precioUsd: "800",
    fechaInicioVentas: "2026-11-01",
    fechaCierreVentas: "2026-11-30",
    fechaInicioClases: "2026-12-01",
    estado: "activo",
  }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programa.id, nombre: "Formulario" }).returning();
  const [lead] = await db.insert(leads).values({
    programId: programa.id,
    emailNormalizado: "alexander@retia.test",
    nombre: "Alexander Ruiz",
    fechaPrimeraAplicacion: new Date("2026-11-09T08:00:00-05:00"),
  }).returning();
  const [envio] = await db.insert(submissions).values({
    leadId: lead.id,
    sourceId: fuente.id,
    token: "evaluacion-alexander",
    fechaEnvio: new Date("2026-11-09T08:00:00-05:00"),
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmId: "anuncio-evaluaciones",
  }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programa.id,
    leadId: lead.id,
    submissionOrigenId: envio.id,
    cohortId: cohorte.id,
    ownerUserId: alejo.id,
    etapa: "ganado_parcial",
    valorVendidoUsd: "800",
    fechaLimitePago: "2026-11-01",
  }).returning();
  await editarDeal(db, { userId: gerente.id, rol: "gerente", operaComoCloser: false }, { dealId: deal.id, ownerUserId: nicolas.id });
  await db.insert(dealEtapaHistorial).values({
    dealId: deal.id,
    de: "agendado",
    a: "ganado_parcial",
    userId: nicolas.id,
    fecha: new Date("2026-11-10T12:00:00-05:00"),
  });
  await db.insert(calls).values({
    programId: programa.id,
    dealId: deal.id,
    closerUserId: nicolas.id,
    resultado: "agendada",
    fechaAgenda: new Date("2026-11-14T09:00:00-05:00"),
    origen: "app",
  });
  await db.insert(abonos).values({
    programId: programa.id,
    dealId: deal.id,
    fecha: "2026-11-11",
    monto: "200",
    moneda: "USD",
    registradoPorUserId: nicolas.id,
  });
  await db.insert(gastoPauta).values({
    programId: programa.id,
    fecha: "2026-11-10",
    monto: "100",
    moneda: "USD",
    origen: "manual",
    area: "paid",
  });
});

afterAll(async () => cerrar());

function contexto(): ContextoMcp {
  return {
    db,
    rol: "gerente",
    tokenId: crypto.randomUUID(),
    escritura: false,
    session: {
      user: {
        id: gerenteId,
        email: "gerente-evaluaciones@retia.test",
        name: "Mani",
        rol: "gerente",
        operaComoCloser: false,
        closerId: null,
        alcanceLimitado: false,
      },
    } as Session,
  };
}

async function herramientasDescubribles(ctx: ContextoMcp): Promise<Set<string>> {
  const salida = await capacidadesMcp.ejecutar(ctx, capacidadesMcp.entrada.parse({ detalle: "nombre" }));
  const consultas = salida.estructurado.consultas as Array<{ nombre: string }>;
  return new Set(consultas.map((consulta) => consulta.nombre));
}

describe("evaluaciones de preguntas reales del MCP", () => {
  for (const evaluacion of EVALUACIONES) {
    if (evaluacion.pregunta.includes("A-177")) {
      it.todo(`${evaluacion.pregunta} — pendiente: la cesión espera ADR, caso de uso en lib/ y registro en ACCIONES`);
      continue;
    }

    it(evaluacion.pregunta, async () => {
      const ctx = contexto();
      const descubribles = await herramientasDescubribles(ctx);
      for (const nombre of evaluacion.herramientasEsperadas) expect(descubribles).toContain(nombre);

      const llamadas: string[] = [];
      const evaluacionCtx: ContextoDeEvaluacion = {
        async llamar(nombre, entrada) {
          llamadas.push(nombre);
          expect(llamadas.length, `La pregunta superó ${evaluacion.maxLlamadas} llamadas`).toBeLessThanOrEqual(evaluacion.maxLlamadas);
          expect(evaluacion.herramientasEsperadas, `La herramienta ${nombre} no estaba esperada`).toContain(nombre);
          const herramienta = HERRAMIENTAS.find((candidata) => candidata.nombre === nombre);
          expect(herramienta, `No existe el handler ${nombre}`).toBeDefined();
          const pedido = herramienta!.entrada.parse(entrada) as never;
          return herramienta!.ejecutar(ctx, pedido);
        },
      };

      await evaluacion.ejecutar(evaluacionCtx);
      expect([...new Set(llamadas)].sort()).toEqual([...evaluacion.herramientasEsperadas].sort());
    });
  }
});
