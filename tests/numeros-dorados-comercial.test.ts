import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { calls, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import { armarVistaDelDashboard, resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * NUMEROS DORADOS DE COMERCIAL (390): todos los esperados salen a mano de la semilla.
 * El semáforo de WhatsApp no pinta citas, realizadas, no asistió, sin resultado ni estas tasas comerciales;
 * sus cifras son de pauta, por eso aquí no hay una tercera comparación contra su mensaje.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let gerenteId: string;
let secuencia = 0;

const HOY = "2026-11-13";
const AHORA = new Date("2026-11-13T12:00:00-05:00");
const RANGO = { desde: "2026-11-01", hasta: "2026-11-30" };
const periodo = { preset: "custom" as const, a: RANGO, comparaciones: [] };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

async function nuevoDeal(programId: string, etapa: EtapaDeal = "agendado", extra: Partial<typeof deals.$inferInsert> = {}) {
  const [lead] = await db.insert(leads).values({
    programId,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `dorado-comercial-${++secuencia}@retia.test`,
  }).returning();
  return (await db.insert(deals).values({ programId, leadId: lead.id, etapa, ...extra }).returning())[0];
}

async function cita(programId: string, dealId: string | null, dia: string, resultado: typeof calls.$inferInsert.resultado) {
  await db.insert(calls).values({
    programId,
    dealId,
    resultado,
    fechaAgenda: new Date(`${dia}T10:00:00-05:00`),
    createdAt: new Date(`${dia}T08:00:00-05:00`),
  });
}

beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "dorado-comercial", nombre: "Dorado Comercial", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro-dorado-comercial", nombre: "Otro Dorado", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  gerenteId = (await db.insert(users).values({ email: "gerente-dorado-comercial@retia.test", rol: "gerente" }).returning())[0].id;

  // Cita futura: es cita del rango, pero todavía no pertenece al grupo resuelto.
  await cita(programaA, (await nuevoDeal(programaA)).id, "2026-11-20", "agendada");
  // Cita pasada sin marcar: es cita y sin resultado; falta en la cobertura, no es no show.
  await cita(programaA, (await nuevoDeal(programaA)).id, "2026-11-05", "agendada");
  // Show vendido: cuenta como cita, realizada, venta y numerador de las dos tasas de cierre.
  const venta = await nuevoDeal(programaA, "ganado_parcial", { valorVendidoUsd: "1000", ownerUserId: gerenteId });
  await db.insert(dealEtapaHistorial).values({ dealId: venta.id, a: "ganado_parcial", fecha: new Date("2026-11-06T12:00:00-05:00") });
  await cita(programaA, venta.id, "2026-11-06", "show");
  // No asistió: cuenta como cita resuelta y denominador de asistencia, pero no como realizada.
  await cita(programaA, (await nuevoDeal(programaA)).id, "2026-11-07", "no_show");
  // Reagendada: la vieja cuenta entre las citas crudas, pero el grupo la excluye y lo representa la nueva, que sí fue show.
  const reagendada = await nuevoDeal(programaA, "atendido");
  await cita(programaA, reagendada.id, "2026-11-08", "reagendada");
  await cita(programaA, reagendada.id, "2026-11-10", "show");
  // Cortesía: su llamada sigue siendo cita/realizada, pero el deal queda fuera del grupo y de ventas.
  await cita(programaA, (await nuevoDeal(programaA, "ganado_completo", { cortesia: true, ownerUserId: gerenteId })).id, "2026-11-09", "show");
  // Deal anulado con llamada vigente: ni la llamada ni el deal cuentan en ninguna métrica.
  const anulado = await nuevoDeal(programaA, "atendido", {
    anuladoEn: new Date("2026-11-11T12:00:00-05:00"), anuladoPor: gerenteId, motivoAnulacion: "Caso dorado",
  });
  await cita(programaA, anulado.id, "2026-11-11", "show");
  // Llamada suelta: cuenta en las cifras por llamada, pero no puede pertenecer al grupo por deal.
  await cita(programaA, null, "2026-11-12", "show");
  // El mismo caso en otro programa nunca cruza la frontera del programa A.
  const otro = await nuevoDeal(programaB, "ganado_parcial", { valorVendidoUsd: "1500", ownerUserId: gerenteId });
  await db.insert(dealEtapaHistorial).values({ dealId: otro.id, a: "ganado_parcial", fecha: new Date("2026-11-06T12:00:00-05:00") });
  await cita(programaB, otro.id, "2026-11-06", "show");
}, 60_000);

function contexto(): ContextoMcp {
  return {
    db,
    session: { user: { id: gerenteId, email: "gerente-dorado-comercial@retia.test", name: "Gerente" } } as Session,
    rol: "gerente",
    tokenId: crypto.randomUUID(),
    escritura: false,
  };
}

async function vistaDelHub() {
  const entrada = { programId: programaA, hoy: HOY, ahora: AHORA, periodo, preset: "custom" };
  return armarVistaDelDashboard(entrada, db, resolverContextoDeVista(entrada, db));
}

describe("dorado de Comercial: el Hub", () => {
  it("da las siete cifras calculadas a mano según el diccionario", async () => {
    const vista = await vistaDelHub();
    expect(vista.embudo.agendas).toBe(8);
    expect(vista.embudo.llamadasConShow).toBe(4);
    expect(vista.embudo.estadosDeCitas.noShow).toBe(1);
    expect(vista.sinResultado).toBe(1);
    expect(vista.embudo.razonShow.valor).toBeCloseTo(2 / 3);
    expect(vista.embudo.razonCierre.valor).toBeCloseTo(1 / 2);
    expect(vista.embudo.agendaAVenta).toBeCloseTo(1 / 3);
  });
});

describe("dorado de Comercial: resumen_del_hub", () => {
  it("conserva los mismos números que la función canónica del Hub", async () => {
    const hub = await vistaDelHub();
    const salida = await resumenDelHubMcp.ejecutar(contexto(), {
      programa: "dorado-comercial", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta,
    });
    const mcp = salida.estructurado as {
      cifras: { ventas: { valor: number }; citas: { valor: number }; shows: { valor: number } };
      tasas: {
        asistencia: { valor: number | null };
        cierre_de_ventas: { valor: number | null };
        cita_a_venta: { valor: number | null };
      };
    };

    expect(mcp.cifras.citas.valor).toBe(8);
    expect(mcp.cifras.shows.valor).toBe(4);
    expect(mcp.cifras.ventas.valor).toBe(1);
    expect(mcp.tasas.asistencia.valor).toBeCloseTo(2 / 3);
    expect(mcp.tasas.cierre_de_ventas.valor).toBeCloseTo(1 / 2);
    expect(mcp.tasas.cita_a_venta.valor).toBeCloseTo(1 / 3);
    expect(mcp.cifras.citas.valor).toBe(hub.embudo.agendas);
    expect(mcp.cifras.shows.valor).toBe(hub.embudo.llamadasConShow);
    expect(mcp.tasas.asistencia.valor).toBe(hub.embudo.razonShow.valor);
    expect(mcp.tasas.cierre_de_ventas.valor).toBe(hub.embudo.razonCierre.valor);
    expect(mcp.tasas.cita_a_venta.valor).toBe(hub.embudo.agendaAVenta);
  });
});
