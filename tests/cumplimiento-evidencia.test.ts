import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, cohorts, dealEtapaHistorial, deals, leads, objetivos, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leerCumplimientoDeCohorte } from "@/lib/metas/cumplimiento-de-cohorte";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * La evidencia de cada barra del cumplimiento (419): la lista que abre la barra cuenta EXACTAMENTE lo mismo que la
 * barra (ADR 0067, ADR 0115 N2). Se siembran los casos que harían divergir cifra y lista: agenda antes del inicio de
 * ventas, de otra cohorte, anulada, sobre un deal anulado; venta anterior al inicio (cuenta, DA-2), de otra cohorte,
 * de otra área, sobre un deal anulado.
 */
const INICIO = "2026-11-02";
const HOY = "2026-11-10";

describe("419: la lista de cada barra del cumplimiento cuenta lo mismo que la barra", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let fuenteId: string;
  let c1: string;
  let c2: string;
  let dueno: string;
  let n = 0;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  afterAll(async () => cerrar());
  beforeEach(async () => {
    await vaciar();
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "evidencia", nombre: "Evidencia", ticketUsd: "1000" }).returning();
    programId = p.id;
    [{ id: fuenteId }] = await db.insert(sources).values({ programId, nombre: "Fuente" }).returning();
    const cohorte = (codigo: string) => ({
      programId, codigo, metaCupos: 10, precioUsd: "1000", fechaInicioVentas: INICIO,
      fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "activo" as const,
    });
    [{ id: c1 }] = await db.insert(cohorts).values(cohorte("C1")).returning();
    [{ id: c2 }] = await db.insert(cohorts).values({ ...cohorte("C2"), fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-09-30", fechaInicioClases: "2026-10-01", estado: "cerrado" }).returning();
    dueno = await duenoDePrueba(db, programId);
    await db.insert(objetivos).values([
      { cohortId: c1, area: null, metrica: "agendas", meta: "20", activo: true },
      { cohortId: c1, area: "paid", metrica: "cupos", meta: "10", activo: true },
    ]);
  });

  async function deal(opciones: { cohorteId: string; medium: string; vendidoEl?: string; anulado?: boolean }) {
    const token = `t${++n}`;
    const [lead] = await db.insert(leads).values({ programId, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, emailNormalizado: `${token}@t.co` }).returning();
    const [envio] = await db.insert(submissions).values({
      sourceId: fuenteId, leadId: lead.id, token, utmSource: "facebook", utmMedium: opciones.medium,
      fechaEnvio: new Date("2026-10-20T09:00:00-05:00"),
    }).returning();
    const [fila] = await db.insert(deals).values({
      programId, leadId: lead.id, cohortId: opciones.cohorteId, submissionOrigenId: envio.id, ownerUserId: dueno,
      etapa: opciones.vendidoEl ? "ganado_completo" : "agendado",
      valorVendidoUsd: opciones.vendidoEl ? "900" : null,
      ...(opciones.anulado ? { anuladoEn: new Date(), anuladoPor: dueno, motivoAnulacion: "error" } : {}),
    }).returning();
    if (opciones.vendidoEl) {
      await db.insert(dealEtapaHistorial).values({ dealId: fila.id, a: "ganado_completo", fecha: new Date(`${opciones.vendidoEl}T10:00:00-05:00`) });
    }
    return fila.id;
  }

  async function agenda(dealId: string, dia: string, anulada = false) {
    await db.insert(calls).values({
      programId, dealId, createdAt: new Date(`${dia}T11:00:00-05:00`),
      ...(anulada ? { anuladoEn: new Date(), anuladoPor: dueno, motivoAnulacion: "error" } : {}),
    });
  }

  async function sembrar() {
    // Agendas de C1 en el rango: 2 de pauta y 1 orgánica (las tres cuentan: la meta de agendas es de todas las áreas).
    for (const medium of ["paid_social", "paid_social", "organic"]) await agenda(await deal({ cohorteId: c1, medium }), "2026-11-04");
    await agenda(await deal({ cohorteId: c1, medium: "paid_social" }), "2026-10-30"); // antes del inicio: no cuenta
    await agenda(await deal({ cohorteId: c2, medium: "paid_social" }), "2026-11-04"); // otra cohorte
    await agenda(await deal({ cohorteId: c1, medium: "paid_social" }), "2026-11-05", true); // agenda anulada
    await agenda(await deal({ cohorteId: c1, medium: "paid_social", anulado: true }), "2026-11-05"); // deal anulado
    // Ventas de C1: 2 de pauta (una ANTES del inicio de ventas, que cuenta) y 1 orgánica.
    await deal({ cohorteId: c1, medium: "paid_social", vendidoEl: "2026-11-06" });
    await deal({ cohorteId: c1, medium: "cpc", vendidoEl: "2026-10-28" });
    await deal({ cohorteId: c1, medium: "organic", vendidoEl: "2026-11-07" });
    await deal({ cohorteId: c2, medium: "paid_social", vendidoEl: "2026-11-06" }); // otra cohorte
    await deal({ cohorteId: c1, medium: "paid_social", vendidoEl: "2026-11-06", anulado: true }); // deal anulado
  }

  const seccion = async (...args: Parameters<typeof listaDeMetrica>) => (await listaDeMetrica(...args))[0];
  const cantidad = async (...args: Parameters<typeof listaDeMetrica>) => (await seccion(...args)).subtotal.cantidad;

  // PENDIENTE (Mani): la barra cuenta la agenda de un deal ANULADO (`hechos/agenda.ts` une los deals con
  // `incluyendoAnulados`) y la lista no (ADR 0038). Hasta que se decida, la barra de agendas no abre evidencia.
  // `it.fails`: cuando las dos cuadren, este test se pone rojo y avisa que ya se puede conectar.
  it.fails("agendas: la barra y la lista de agendas creadas de la cohorte desde el inicio de ventas", async () => {
    await sembrar();
    const datos = await leerCumplimientoDeCohorte(programId, c1, HOY, db);
    const lista = await cantidad("agendas_creadas", { programId, rango: { desde: INICIO, hasta: HOY }, cohorteId: c1, hoy: HOY }, 1, db);
    expect(datos.agendas?.cupos.llevamos).toBe(3);
    expect(lista).toBe(datos.agendas?.cupos.llevamos);
  });

  it("ventas totales: la barra y la lista de ventas de la cohorte desde la venta más vieja", async () => {
    await sembrar();
    const datos = await leerCumplimientoDeCohorte(programId, c1, HOY, db);
    const lista = await cantidad("cierres", { programId, rango: { desde: "2026-10-28", hasta: HOY }, cohorteId: c1, hoy: HOY }, 1, db);
    expect(datos.ventasTotales?.cupos.llevamos).toBe(3);
    expect(lista).toBe(datos.ventasTotales?.cupos.llevamos);
  });

  it("ventas de pauta: la barra y la lista de ventas de la cohorte con área Paid", async () => {
    await sembrar();
    const datos = await leerCumplimientoDeCohorte(programId, c1, HOY, db);
    const lista = await cantidad("cierres", { programId, rango: { desde: "2026-10-28", hasta: HOY }, cohorteId: c1, hoy: HOY, area: "paid" }, 1, db);
    expect(datos.ventasPauta?.cupos.llevamos).toBe(2);
    expect(lista).toBe(datos.ventasPauta?.cupos.llevamos);
    // El dinero de la lista sale de las mismas filas: lo vendido de la barra.
    const conDinero = await seccion("cierres", { programId, rango: { desde: "2026-10-28", hasta: HOY }, cohorteId: c1, hoy: HOY, area: "paid" }, 1, db);
    expect(conDinero.dinero?.vendido).toBe(1800);
    expect(conDinero.dinero?.vendido).toBe(datos.ventasPauta?.usd?.llevamos);
    expect(conDinero.filas).toHaveLength(2);
  });
});
