import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { embudoDelRango, embudoPorCloser } from "@/lib/queries/dashboard";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { armarVistaDeMisMetricas } from "@/lib/queries/mi-espacio-metricas";
import { calcularTasasDelGrupo, rangoMadurando, type CitaParaTasas } from "@/lib/queries/tasas-del-grupo";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 187 (ADR 0079): las tasas del embudo se cuentan sobre el MISMO grupo de personas.
 *
 * Semana pasada (S1, 21 a 25-sep) y esta (S2, 28-sep a 2-oct), mirado el 2-oct a las 23:00 de Bogotá.
 * En S1 el grupo del programa A son cuatro deals: d1 (show de Ana, dueño Beto, vendido el 1-oct),
 * d2 (no-show y luego show con Ana), d3 (cita cancelada con Beto) y d9 (no-show con Beto, vendido
 * sin show). Quedan fuera: un deal anulado, una cortesía, una cita reagendada, otro programa y una
 * cita futura.
 */

const S1 = { desde: "2026-09-21", hasta: "2026-09-25" };
const S2 = { desde: "2026-09-28", hasta: "2026-10-02" };
const AHORA = new Date("2026-10-02T23:00:00-05:00");
const HOY = "2026-10-02";

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let ana: string;
let beto: string;
let n = 0;
const ids: Record<string, string> = {};

const enBogota = (dia: string, hora = "10:00") => new Date(`${dia}T${hora}:00-05:00`);

async function deal(
  programId: string,
  etapa: EtapaDeal,
  extra: Partial<typeof deals.$inferInsert> = {},
): Promise<string> {
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `lead${++n}@correo.co` }).returning();
  const [d] = await db.insert(deals).values({ programId, leadId: lead.id, etapa, ...extra }).returning();
  return d.id;
}

async function cita(programId: string, dealId: string, closerUserId: string, dia: string, resultado: string) {
  await db.insert(calls).values({
    programId,
    dealId,
    closerUserId,
    fechaAgenda: enBogota(dia),
    resultado: resultado as typeof calls.$inferInsert.resultado,
  });
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "1000" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1000" }).returning();
  programaA = a.id;
  programaB = b.id;
  const [uAna] = await db.insert(users).values({ email: "ana@retia.co", rol: "closer", closerId: "Ana" }).returning();
  const [uBeto] = await db.insert(users).values({ email: "beto@retia.co", rol: "closer", closerId: "Beto" }).returning();
  ana = uAna.id;
  beto = uBeto.id;

  ids.d1 = await deal(programaA, "ganado_parcial", { ownerUserId: beto });
  await db.insert(dealEtapaHistorial).values({ dealId: ids.d1, de: "atendido", a: "ganado_parcial", fecha: enBogota("2026-10-01") });
  await cita(programaA, ids.d1, ana, "2026-09-22", "show");

  ids.d2 = await deal(programaA, "atendido", { ownerUserId: ana });
  await cita(programaA, ids.d2, ana, "2026-09-23", "no_show");
  await cita(programaA, ids.d2, ana, "2026-09-25", "show");

  ids.d3 = await deal(programaA, "agendado", { ownerUserId: beto });
  await cita(programaA, ids.d3, beto, "2026-09-22", "cancelada");

  ids.d9 = await deal(programaA, "ganado_parcial", { ownerUserId: beto });
  await cita(programaA, ids.d9, beto, "2026-09-24", "no_show");

  // Fuera del grupo.
  const anulado = await deal(programaA, "atendido", { anuladoEn: new Date(), anuladoPor: ana, motivoAnulacion: "error" });
  await cita(programaA, anulado, ana, "2026-09-22", "show");
  const cortesia = await deal(programaA, "ganado_completo", { cortesia: true });
  await cita(programaA, cortesia, ana, "2026-09-22", "show");
  const reagendada = await deal(programaA, "agendado");
  await cita(programaA, reagendada, ana, "2026-09-22", "reagendada");
  const otroPrograma = await deal(programaB, "ganado_parcial");
  await cita(programaB, otroPrograma, ana, "2026-09-22", "show");

  // Esta semana: un show sin venta, y una cita futura que no cuenta todavía.
  ids.d10 = await deal(programaA, "atendido", { ownerUserId: ana });
  await cita(programaA, ids.d10, ana, "2026-09-29", "show");
  const futura = await deal(programaA, "agendado");
  await db.insert(calls).values({ programId: programaA, dealId: futura, closerUserId: ana, fechaAgenda: enBogota("2026-10-02", "23:30") });
}, 60_000);

afterEach(async () => cerrar());

describe("ticket 187: el grupo de citas", () => {
  it("cuenta personas del grupo, con la cadena completa y sin pasar de 100%", async () => {
    const embudo = await embudoDelRango({ programId: programaA, rango: S1 }, db, AHORA);

    expect(embudo.grupo).toMatchObject({ deals: 4, conShow: 2, vendidos: 1 });
    expect(embudo.pctShow).toBe(0.5);
    expect(embudo.pctCierre).toBe(0.5);
    expect(embudo.agendaAVenta).toBe(0.25);
    expect(embudo.pctShow! * embudo.pctCierre!).toBeCloseTo(embudo.agendaAVenta!);
    for (const t of [embudo.pctShow, embudo.pctCierre, embudo.agendaAVenta]) expect(t!).toBeLessThanOrEqual(1);
  });

  it("el show de la semana pasada con venta hoy cuenta en la semana pasada, no en esta", async () => {
    const lista = await listaDeMetrica("grupo_citas", { programId: programaA, rango: S2, hoy: HOY, ahora: AHORA }, 1, db);
    expect(lista[0].filas.map((f) => f.dealId)).toEqual([ids.d10]);
    const esta = await embudoDelRango({ programId: programaA, rango: S2 }, db, AHORA);
    expect(esta.grupo).toMatchObject({ deals: 1, conShow: 1, vendidos: 0 });
    // Las cantidades no cambian: la venta de d1 es del 1-oct y cuenta en el periodo de esta semana.
    expect(esta.cierres).toBe(1);
    expect(esta.pctCierre).toBe(0);
  });

  it("la cita futura no entra aunque caiga en el rango", async () => {
    const embudo = await embudoDelRango({ programId: programaA, rango: { desde: "2026-09-21", hasta: "2026-10-02" } }, db, AHORA);
    expect(embudo.grupo.deals).toBe(5);
  });

  it("por closer: el show de Ana sobre un deal de Beto cuenta en el % de cierre de Ana", async () => {
    const ana187 = await embudoDelRango({ programId: programaA, rango: S1, claveCloser: ana }, db, AHORA);
    const beto187 = await embudoDelRango({ programId: programaA, rango: S1, claveCloser: beto }, db, AHORA);
    expect(ana187.grupo).toMatchObject({ deals: 2, conShow: 2, vendidos: 1 });
    expect(ana187.pctCierre).toBe(0.5);
    expect(beto187.grupo).toMatchObject({ deals: 2, conShow: 0, vendidos: 0 });
    expect(beto187.pctCierre).toBeNull();
  });

  it("el comparativo, el dashboard filtrado y Mi espacio dan el mismo número", async () => {
    const filas = await embudoPorCloser({ programId: programaA, rango: S1 }, db, AHORA);
    const deAna = filas.find((f) => f.clave === ana)!;
    const dashboard = await armarVistaDelDashboard(
      { programId: programaA, hoy: HOY, preset: "custom", periodo: { preset: "custom", a: S1 }, claveCloser: ana, ahora: AHORA },
      db,
    );
    const miEspacio = await armarVistaDeMisMetricas(
      { programa: { id: programaA, slug: "a", nombre: "A" }, closerUserId: ana, hoy: HOY, periodo: { preset: "custom", a: S1 } },
      db,
    );
    expect(deAna.pctCierre).toBe(0.5);
    expect(dashboard.embudo.pctCierre).toBe(0.5);
    expect(miEspacio.a.pctCierre).toBe(0.5);
    expect(miEspacio.detalles.grupoVendidos.resumen.subtotal.cantidad).toBe(1);
  });

  it("cada tasa abre su lista con tantas filas como dice la cifra", async () => {
    const filtros = { programId: programaA, rango: S1, hoy: HOY, ahora: AHORA };
    const [grupo] = await listaDeMetrica("grupo_citas", filtros, 1, db);
    const [shows] = await listaDeMetrica("grupo_shows", filtros, 1, db);
    const [vendidos] = await listaDeMetrica("grupo_vendidos", filtros, 1, db);
    expect(grupo.subtotal.cantidad).toBe(4);
    expect(grupo.filas).toHaveLength(4);
    expect(new Set(grupo.filas.map((f) => f.dealId))).toEqual(new Set([ids.d1, ids.d2, ids.d3, ids.d9]));
    expect(shows.filas.map((f) => f.dealId).sort()).toEqual([ids.d1, ids.d2].sort());
    expect(vendidos.filas.map((f) => f.dealId)).toEqual([ids.d1]);

    const [deAna] = await listaDeMetrica("grupo_vendidos", { ...filtros, claveCloser: ana }, 1, db);
    expect(deAna.subtotal.cantidad).toBe(1);
    expect(deAna.filas[0].claveCloser).toBe(ana);
  });
});

describe("ticket 187: la cuenta pura", () => {
  const base = (over: Partial<CitaParaTasas>): CitaParaTasas => ({
    callId: "c", dealId: "d", claveCloser: "u1", closer: "Ana", resultado: "show",
    instante: new Date("2026-09-22T15:00:00Z"), etapa: "atendido", ...over,
  });

  it("un deal con varias citas cuenta una vez, en el closer de su último show", () => {
    const grupo = calcularTasasDelGrupo({
      citas: [
        base({ callId: "c1", resultado: "no_show", claveCloser: "u2", closer: "Beto" }),
        base({ callId: "c2", resultado: "show", instante: new Date("2026-09-23T15:00:00Z") }),
        base({ callId: "c3", resultado: "no_show", claveCloser: "u2", closer: "Beto", instante: new Date("2026-09-24T15:00:00Z") }),
      ],
      rango: S1,
      hoy: HOY,
      ahora: AHORA,
    });
    expect(grupo.tasas).toMatchObject({ deals: 1, conShow: 1 });
    expect(grupo.miembros[0]).toMatchObject({ callId: "c2", claveCloser: "u1" });
    expect([...grupo.porCloser.keys()]).toEqual(["u1"]);
  });

  it("aún madurando cuando el rango terminó hace menos de 30 días", () => {
    expect(rangoMadurando({ desde: "2026-09-01", hasta: "2026-09-30" }, "2026-10-02")).toBe(true);
    expect(rangoMadurando({ desde: "2026-08-01", hasta: "2026-08-31" }, "2026-10-02")).toBe(false);
  });
});
