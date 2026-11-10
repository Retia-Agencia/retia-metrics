import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, cohorts, deals, gastoPauta, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agendasDeLaCohorte, agendasDePauta } from "@/lib/queries/hechos/agenda";
import { cargarPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Paridad N2 de las cifras de agendas (412 F, ADR 0115 N1/N2). Tres pantallas contaban agendas con filtros
 * distintos escritos a mano (tabla semanal, costo por agenda, Cumplimiento) y daban 28, 28 y 57 sin decir por qué.
 * Aquí se siembra el caso que las haría divergir y se exige que cada cifra salga de `agendasDePauta` o
 * `agendasDeLaCohorte`, con el universo que su nombre dice.
 */
const DIA = "2026-11-05";
const OTRO_DIA = "2026-11-06";
const HOY = "2026-11-10";

describe("agendas: una pregunta por universo", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let fuenteId: string;
  let c1: string;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  beforeEach(async () => {
    await vaciar();
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "agendas", nombre: "Agendas", ticketUsd: "1000" }).returning();
    programId = p.id;
    [{ id: fuenteId }] = await db.insert(sources).values({ programId, nombre: "Fuente" }).returning();
    [{ id: c1 }] = await db.insert(cohorts).values({
      programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioVentas: "2026-11-01",
      fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "cerrado",
    }).returning();
  });
  afterAll(async () => cerrar());

  let consecutivo = 0;
  async function agenda(medium: string, dia: string, cohorteId: string | null) {
    const token = `t${++consecutivo}`;
    const [lead] = await db.insert(leads).values({
      programId, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, emailNormalizado: `${token}@test.co`,
    }).returning();
    const [envio] = await db.insert(submissions).values({
      sourceId: fuenteId, leadId: lead.id, token, utmSource: "meta", utmMedium: medium,
      fechaEnvio: new Date(`${dia}T09:00:00-05:00`),
    }).returning();
    const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, submissionOrigenId: envio.id, cohortId: cohorteId }).returning();
    await db.insert(calls).values({ programId, dealId: deal.id, createdAt: new Date(`${dia}T11:00:00-05:00`) });
  }

  async function sembrar() {
    for (let i = 0; i < 3; i++) await agenda("paid_social", DIA, c1);
    for (let i = 0; i < 2; i++) await agenda("organic", DIA, c1);
    await agenda("paid_social", DIA, null);
    await agenda("paid_social", OTRO_DIA, c1);
    await db.insert(gastoPauta).values({ programId, fecha: DIA, monto: "120000", moneda: "COP", origen: "manual", area: "paid" });
  }

  const suma = (filas: Array<{ agendas: number }>) => filas.reduce((n, f) => n + f.agendas, 0);

  it("cada universo tiene su cifra y su nombre", async () => {
    await sembrar();
    const un = { desde: DIA, hasta: DIA };
    expect(suma(await agendasDePauta(db, { programId, rango: un }))).toBe(4);
    expect(suma(await agendasDePauta(db, { programId, rango: un, cohorteId: c1 }))).toBe(3);
    // Cumplimiento: todos los orígenes de la cohorte, todo el rango (3 paid + 2 orgánicas + 1 paid de otro día).
    expect(await agendasDeLaCohorte(db, { programId, rango: { desde: "2026-11-01", hasta: HOY }, cohorteId: c1 })).toBe(6);
  });

  it("la tabla semanal y el costo comparten el denominador, con y sin cohorte", async () => {
    await sembrar();
    const rango = { desde: DIA, hasta: DIA };
    for (const [cohorteId, esperadas] of [[c1, 3], [null, 4]] as const) {
      const vista = await cargarPautaSemanal(db, { programId, rango, hoy: HOY, cohorteId });
      const agendas = vista.filas.find((f) => f.clave === "agendas")!.celdas.total.valor;
      const costo = vista.filas.find((f) => f.clave === "costo_agenda_crm")!.celdas.total.valor;
      expect(agendas).toBe(esperadas);
      expect(costo).toBe(120000 / esperadas);
    }
  });

  it("el costo de ventana cuenta las agendas con el mismo filtro de cohorte", async () => {
    await sembrar();
    const ventana = await costoPorAgendaDeVentana(db, { programId, desde: DIA, hasta: DIA, cohorteId: c1 });
    expect(ventana.agendasCrm).toBe(3);
    expect((await costoPorAgendaDeVentana(db, { programId, desde: DIA, hasta: DIA })).agendasCrm).toBe(4);
  });

  it("una semana con agendas y sin gasto de agenda no inventa COP 0", async () => {
    await agenda("paid_social", DIA, c1);
    const vista = await cargarPautaSemanal(db, { programId, rango: { desde: DIA, hasta: DIA }, hoy: HOY, cohorteId: c1 });
    const celda = vista.filas.find((f) => f.clave === "costo_agenda_crm")!.celdas.total;
    expect(celda.valor).toBeNull();
  });
});

describe("guardián: el filtro de área de las agendas vive en un solo módulo", () => {
  const CARPETAS = ["app", "components", "lib", "scripts"];
  const DUENO = "lib/queries/hechos/agenda.ts";
  function recorrer(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "node_modules" ? [] : recorrer(join(dir, e.name))) : [join(dir, e.name)]);
  }
  /** Lee el hecho de agendas por sus funciones crudas (`agrupar`/`listar`), no por las dos preguntas. */
  const USA_AGENDAS_CRUDAS = /\bagenda\.(agrupar|listar)\b|agruparAgendas|\{[^}]*\b(agrupar|listar)\b[^}]*\}\s*from\s*"@\/lib\/queries\/hechos\/agenda"/;
  /** Archivos que leen agendas crudas el hecho de agendas y escriben a mano el filtro de área Paid. */
  function infractores(fuentes: Array<{ ruta: string; texto: string }>): string[] {
    return fuentes
      .filter(({ ruta, texto }) => ruta !== DUENO
        && USA_AGENDAS_CRUDAS.test(texto)
        && /area:\s*\[\s*["']paid["']\s*\]/.test(texto))
      .map(({ ruta }) => ruta);
  }

  it("ningún archivo fuera del módulo escribe area: [\"paid\"] junto a las agendas", () => {
    const fuentes = CARPETAS.flatMap((c) => recorrer(c)).filter((r) => /\.tsx?$/.test(r))
      .map((ruta) => ({ ruta: relative(process.cwd(), ruta), texto: readFileSync(ruta, "utf8") }));
    expect(infractores(fuentes)).toEqual([]);
  });

  it("muerde: agendas crudas con el filtro a mano se marcan; las ventas con el mismo filtro, no", () => {
    const malo = { ruta: "lib/x.ts", texto: 'import * as agenda from "@/lib/queries/hechos/agenda";\nagenda.agrupar(db, { filtros: { area: ["paid"] } })' };
    const ajeno = { ruta: "lib/y.ts", texto: 'venta.listar(db, { filtros: { area: ["paid"] } })' };
    expect(infractores([malo, ajeno])).toEqual(["lib/x.ts"]);
  });
});
