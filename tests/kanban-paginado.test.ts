import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { calls, cohorts, dealActividades, dealEtapaHistorial, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { columnaDelDeal, columnaDelDealSql, ETAPAS, PENDIENTES, type VistaDelTablero } from "@/lib/deals/etapas";
import { canalDeLead, canalDeLeadSql, entradaAEtapaActualSql, entradasAEtapaActual, fechaLlamadaAgendadaVigenteSql, paginaDelTablero, tableroKanban, type FiltrosKanban } from "@/lib/queries/kanban";
import { ultimaActividadPorDeal, ultimaActividadSql } from "@/lib/queries/ultima-actividad";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohorte1: string;
let cohorte2: string;
let dueno1: string;
let dueno2: string;
const HOY = "2026-11-20";
const AHORA = new Date("2026-11-20T18:00:00-05:00");
beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  const [programa, otroPrograma] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "paginado", nombre: "Paginado", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "paginado-otro", nombre: "Otro", ticketUsd: "1500" },
  ]).returning();
  programId = programa.id;
  const [c1, c2] = await db.insert(cohorts).values([
    { programId, codigo: "C1", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-12-01", fechaInicioClases: "2026-12-02", estado: "activo" },
    { programId, codigo: "C2", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-08-01", fechaCierreVentas: "2026-09-01", fechaInicioClases: "2026-09-02", estado: "cerrado" },
  ]).returning();
  cohorte1 = c1.id;
  cohorte2 = c2.id;
  const [u1, u2] = await db.insert(users).values([
    { email: "uno-paginado@retia.test", nombre: "Uno", rol: "closer", closerId: "uno-paginado" },
    { email: "dos-paginado@retia.test", nombre: "Dos", rol: "closer", closerId: "dos-paginado" },
  ]).returning();
  dueno1 = u1.id;
  dueno2 = u2.id;
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Formulario" }).returning();

  for (let n = 0; n < 7; n += 1) {
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `p${n}@retia.test`, nombre: n === 0 ? "José Núñez" : n === 6 ? null : `Persona ${n}`, leadQuality: n % 2 ? "caliente" : "frio", leadValue: n % 2 ? "alto" : "bajo", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning();
    const [envio] = await db.insert(submissions).values({ leadId: lead.id, sourceId: fuente.id, token: `p-${n}`, utmSource: n % 2 ? "meta" : "google", utmMedium: n % 2 ? "cpc" : "organic" }).returning();
    const [deal] = await db.insert(deals).values({
      programId, leadId: lead.id, submissionOrigenId: envio.id, cohortId: n % 3 ? cohorte1 : cohorte2,
      ownerUserId: n % 2 ? dueno1 : dueno2, etapa: n === 4 ? "agendado" : n % 2 ? "contactado" : "calificado",
      pendiente: n === 4 ? "reagenda" : n === 5 ? "proxima_cohorte" : null,
      cohorteDestinoTexto: n === 5 ? "Cohorte futura" : null,
      fechaSeguimiento: n === 2 ? "2026-11-18" : null,
      createdAt: new Date(n < 2 ? "2026-11-01T12:00:00-05:00" : `2026-11-0${n + 1}T12:00:00-05:00`),
    }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: null, a: deal.etapa, fecha: new Date(`2026-11-0${Math.min(n + 1, 7)}T13:00:00-05:00`) });
    if (n < 3) await db.insert(dealActividades).values({ dealId: deal.id, tipo: "nota", nota: `Actividad ${n}`, userId: dueno1, fecha: new Date(`2026-11-${10 + n}T10:00:00-05:00`) });
    if (n === 1 || n === 4) await db.insert(calls).values({ programId, dealId: deal.id, closerUserId: dueno1, resultado: "agendada", fechaAgenda: new Date(n === 1 ? "2026-11-19T09:00:00-05:00" : "2026-11-25T09:00:00-05:00"), emailLead: lead.emailNormalizado, origen: "manual" });
  }

  const [anuladoLead] = await db.insert(leads).values({ programId, emailNormalizado: "anulado@retia.test", nombre: "Anulado", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning();
  await db.insert(deals).values({ programId, leadId: anuladoLead.id, cohortId: cohorte1, ownerUserId: dueno1, etapa: "contactado", anuladoEn: new Date(), anuladoPor: dueno1, motivoAnulacion: "error" });
  const [ajeno] = await db.insert(leads).values({ programId: otroPrograma.id, emailNormalizado: "ajeno@retia.test", nombre: "Ajeno", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning();
  await db.insert(deals).values({ programId: otroPrograma.id, leadId: ajeno.id, etapa: "contactado" });
});
afterAll(async () => cerrar());

describe("página SQL del tablero", () => {
  async function esperarParidad(
    filtros: Omit<FiltrosKanban, "orden"> & { orden?: FiltrosKanban["orden"] },
    alcance: { tipo: "todos" } | { tipo: "dueno"; userId: string } = { tipo: "todos" },
  ) {
    const tableroEsperado = await tableroKanban(db, programId, alcance, filtros, HOY, AHORA);
    const esperados = tableroEsperado.columnas.flatMap((columna) => columna.tarjetas.map((tarjeta) => tarjeta.dealId));
    const recibidos: string[] = [];
    for (let offset = 0; offset < Math.max(esperados.length, 1); offset += 2) {
      const pagina = await paginaDelTablero(db, programId, alcance, filtros, { limite: 2, offset }, HOY, AHORA);
      expect(pagina.total).toBe(esperados.length);
      recibidos.push(...pagina.ids);
    }
    expect(recibidos).toEqual(esperados);
  }

  it("mantiene paridad para la matriz de filtros, órdenes, vistas y alcance", async () => {
    const periodo = (campo: "actividad" | "seguimiento", desde: string, hasta: string) => ({
      campo, periodo: { preset: "custom" as const, a: { desde, hasta }, b: null },
    });
    const casos: Array<{ nombre: string; filtros: Parameters<typeof esperarParidad>[0]; alcance?: Parameters<typeof esperarParidad>[1] }> = [
      { nombre: "sin filtros", filtros: {} },
      { nombre: "dueño", filtros: { ownerUserId: dueno1 } },
      { nombre: "cohorte", filtros: { cohorteId: cohorte2 } },
      { nombre: "cohorte todas", filtros: { cohorteId: null } },
      { nombre: "canal", filtros: { canal: "meta|cpc" } },
      { nombre: "calidad", filtros: { leadQuality: "caliente" } },
      { nombre: "antigüedad", filtros: { antiguedadMinima: 12 } },
      { nombre: "actividad", filtros: { fecha: periodo("actividad", "2026-11-10", "2026-11-11") } },
      { nombre: "seguimiento", filtros: { fecha: periodo("seguimiento", "2026-11-18", "2026-11-18") } },
      { nombre: "búsqueda sin tilde", filtros: { q: "Jose" } },
      ...(["actividad", "creado", "nombre", "agenda"] as const).flatMap((campo) => (["asc", "desc"] as const).map((sentido) => ({ nombre: `${campo} ${sentido}`, filtros: { orden: { campo, sentido } } }))),
      ...(["llamada", "setteo", "todo"] as VistaDelTablero[]).map((vista) => ({ nombre: `vista ${vista}`, filtros: { vista } })),
      { nombre: "alcance de dueño", filtros: {}, alcance: { tipo: "dueno", userId: dueno1 } },
    ];
    for (const caso of casos) await esperarParidad(caso.filtros, caso.alcance);
  });

  it("columnaDelDealSql es exhaustiva y coincide con la función TypeScript", async () => {
    for (const etapa of ETAPAS) {
      for (const pendiente of [null, ...PENDIENTES]) {
        const expresion = columnaDelDealSql(sql`${etapa}`, sql`${pendiente}`);
        const resultado = await db.execute(sql`select ${expresion} as columna`);
        const filas = Array.isArray(resultado) ? resultado : resultado.rows;
        expect((filas[0] as { columna: string }).columna).toBe(columnaDelDeal(etapa, pendiente));
      }
    }
  });

  it("las demás gemelas SQL coinciden con sus decisiones TypeScript", async () => {
    const tablero = await tableroKanban(db, programId, { tipo: "todos" }, { vista: "todo" }, HOY, AHORA);
    const tarjetas = new Map(tablero.columnas.flatMap((columna) => columna.tarjetas).map((tarjeta) => [tarjeta.dealId, tarjeta]));
    const filasDeals = await db.select({ dealId: deals.id, etapa: deals.etapa, createdAt: deals.createdAt })
      .from(deals).where(eq(deals.programId, programId));
    const visibles = filasDeals.filter((fila) => tarjetas.has(fila.dealId));

    const canales = await db.select({ source: submissions.utmSource, medium: submissions.utmMedium, canal: canalDeLeadSql() }).from(submissions);
    for (const fila of canales) expect(fila.canal).toBe(canalDeLead(fila.source, fila.medium));

    const entradasTs = await entradasAEtapaActual(db, visibles);
    const entradaSql = entradaAEtapaActualSql(db);
    const entradasSql = await db.select({ dealId: deals.id, fecha: entradaSql.fecha }).from(deals)
      .leftJoin(entradaSql, and(eq(entradaSql.dealId, deals.id), eq(entradaSql.etapa, deals.etapa)))
      .where(eq(deals.programId, programId));
    for (const fila of entradasSql) {
      if (!tarjetas.has(fila.dealId)) continue;
      expect(fila.fecha?.getTime() ?? null).toBe(entradasTs.get(fila.dealId)?.getTime() ?? null);
    }

    const agendaSql = fechaLlamadaAgendadaVigenteSql(db);
    const agendas = await db.select({ dealId: deals.id, fecha: agendaSql.fecha }).from(deals)
      .leftJoin(agendaSql, eq(agendaSql.dealId, deals.id)).where(eq(deals.programId, programId));
    for (const fila of agendas) {
      if (!tarjetas.has(fila.dealId)) continue;
      expect(fila.fecha?.getTime() ?? null).toBe(tarjetas.get(fila.dealId)?.llamada?.fecha?.getTime() ?? null);
    }

    const actividadTs = await ultimaActividadPorDeal(db, visibles.map((fila) => fila.dealId), visibles, AHORA);
    const actividadSql = ultimaActividadSql(db, AHORA);
    const actividades = await db.select({ dealId: deals.id, fecha: actividadSql.fecha }).from(deals)
      .leftJoin(actividadSql.actividades, eq(actividadSql.actividades.dealId, deals.id))
      .leftJoin(actividadSql.llamadasCreadas, eq(actividadSql.llamadasCreadas.dealId, deals.id))
      .leftJoin(actividadSql.llamadasAgendadas, eq(actividadSql.llamadasAgendadas.dealId, deals.id))
      .leftJoin(actividadSql.pagos, eq(actividadSql.pagos.dealId, deals.id))
      .leftJoin(actividadSql.movimientos, eq(actividadSql.movimientos.dealId, deals.id))
      .where(eq(deals.programId, programId));
    for (const fila of actividades) {
      if (!tarjetas.has(fila.dealId)) continue;
      expect(fila.fecha.getTime()).toBe(actividadTs.get(fila.dealId)?.getTime());
    }
  });
});
