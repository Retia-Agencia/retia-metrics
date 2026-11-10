import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  calls, cohorts, cuentasPublicitarias, deals, dealEtapaHistorial, gastoPauta, leads, pautaObjetos,
  programs, sources, submissions, tasasCambio,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cargarPautaSemanal, type ClavePautaSemanal, type VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { grupoDeCitas } from "@/lib/queries/tasas-del-grupo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Paridad N2 de la tabla semanal de Pauta contra las otras superficies (403 F3, ADR 0115 N1/N2, D-A/D-B/D-E del
 * audit `docs/audit-hub-2026-11-10.md`). Compara SALIDAS, no imports: I-1 nació con la función correcta y la entrada
 * equivocada. Estos tests nacen rojos con I-1, I-2 e I-8 sin arreglar y los deja en verde el arreglo (F3 bis).
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let anuncioId: string;
let secuencia = 0;

const SEMANA_1 = { desde: "2026-10-05", hasta: "2026-10-11" };
const DOS_SEMANAS = { desde: "2026-10-05", hasta: "2026-10-18" };
const HOY = "2026-10-18";
const AHORA = new Date("2026-10-18T23:59:59-05:00");

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "paridad-pauta", nombre: "Paridad", ticketUsd: "1000" }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId, idMeta: "par-cuenta", nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "par-campana", nivel: "campana", nombre: "Campaña", estado: "ACTIVE", proposito: "agenda" },
    { cuentaId: cuenta.id, programId, idMeta: "par-conjunto", nivel: "conjunto", padreIdMeta: "par-campana", nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "par-anuncio", nivel: "anuncio", padreIdMeta: "par-conjunto", nombre: "Anuncio", estado: "ACTIVE" },
  ]).returning();
  anuncioId = objetos.find((o) => o.nivel === "anuncio")!.id;
  await db.insert(tasasCambio).values([
    { vigenteDesde: "2026-09-28", vigenteHasta: "2026-10-11", pesosPorDolar: "4000", fuente: "prueba" },
    { vigenteDesde: "2026-10-12", vigenteHasta: "2026-10-18", pesosPorDolar: "4000", fuente: "prueba" },
  ]);
});
afterAll(async () => cerrar());

/** Un envío de Paid ese día y su deal; con `venta`, el deal queda vendido el `diaVenta`. */
async function personaDePaid(dia: string, venta?: { diaVenta: string; valor: string }, opciones: { medio?: string; cohortId?: string } = {}) {
  const lead = (await db.insert(leads).values({
    programId, fechaPrimeraAplicacion: new Date(`${dia}T10:00:00-05:00`),
    emailNormalizado: `paridad-${++secuencia}@test.co`, nombre: `Lead ${secuencia}`,
  }).returning())[0];
  const envio = (await db.insert(submissions).values({
    sourceId, leadId: lead.id, token: crypto.randomUUID(), esParcial: false,
    fechaEnvio: new Date(`${dia}T10:00:00-05:00`), createdAt: new Date(`${dia}T10:00:00-05:00`),
    utmSource: "facebook", utmMedium: opciones.medio ?? "cpc", utmId: opciones.medio ? null : "par-anuncio",
  }).returning())[0];
  const deal = (await db.insert(deals).values({
    programId, leadId: lead.id, submissionOrigenId: envio.id,
    ownerUserId: venta ? await duenoDePrueba(db, programId) : null,
    etapa: venta ? "ganado_completo" : "agendado",
    valorVendidoUsd: venta ? venta.valor : null,
    cohortId: opciones.cohortId ?? null,
  }).returning())[0];
  if (venta) {
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date(`${venta.diaVenta}T12:00:00-05:00`) });
  }
  return deal;
}

async function cita(dealId: string, dia: string, resultado: "show" | "no_show" | "agendada") {
  await db.insert(calls).values({
    programId, dealId, resultado,
    fechaAgenda: new Date(`${dia}T11:00:00-05:00`), createdAt: new Date(`${dia}T09:00:00-05:00`),
  });
}

async function gasto(dia: string, monto: string) {
  await db.insert(gastoPauta).values({ programId, fecha: dia, monto, moneda: "COP", origen: "meta_api", pautaObjetoId: anuncioId });
}

const fila = (v: VistaPautaSemanal, clave: ClavePautaSemanal) => v.filas.find((f) => f.clave === clave)!;
const total = (v: VistaPautaSemanal, clave: ClavePautaSemanal) => fila(v, clave).celdas.total;

describe("I-1: show, cierre y agenda → venta de la tabla semanal contra el grupo de citas", () => {
  /**
   * Semana 1, todo Paid. Con resultado: D1 vendido (show), D2 show, D3 no show. Sin marcar (cita pasada): D4, D5.
   * D6 vendido en la semana 1 pero con su show el 30-sep (otra semana). Grupo de la semana: 3 deals, 2 con show,
   * 1 vendido, 2 sin marcar → show 2/3, cierre 1/2, agenda → venta 1/3, "parcial".
   */
  async function sembrar() {
    await cita((await personaDePaid("2026-10-05", { diaVenta: "2026-10-08", valor: "200" })).id, "2026-10-06", "show");
    await cita((await personaDePaid("2026-10-05")).id, "2026-10-07", "show");
    await cita((await personaDePaid("2026-10-05")).id, "2026-10-07", "no_show");
    await cita((await personaDePaid("2026-10-05")).id, "2026-10-06", "agendada");
    await cita((await personaDePaid("2026-10-05")).id, "2026-10-07", "agendada");
    await cita((await personaDePaid("2026-09-30", { diaVenta: "2026-10-09", valor: "200" })).id, "2026-09-30", "show");
  }

  it("el % de show, el cierre y la agenda → venta de Pauta dan lo que da el grupo de citas", async () => {
    await sembrar();
    const [vista, grupo] = await Promise.all([
      cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: null }),
      grupoDeCitas(db, { programId, rango: SEMANA_1, ahora: AHORA }),
    ]);
    // Todo el programa es Paid en este caso: Comercial y el grupo Paid coinciden. Se fija además el valor a mano.
    expect(grupo.tasas.razonShow.valor).toBeCloseTo(2 / 3);
    expect(total(vista, "show").valor).toBeCloseTo(2 / 3);
    expect(total(vista, "cierre_ventas").valor).toBeCloseTo(1 / 2);
    expect(total(vista, "agenda_venta").valor).toBeCloseTo(1 / 3);
  });

  it("dice «parcial» cuando hay citas pasadas sin marcar (N3)", async () => {
    await sembrar();
    const vista = await cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: null });
    for (const clave of ["show", "cierre_ventas", "agenda_venta"] as const) {
      expect(total(vista, clave).cobertura.estado, clave).toBe("parcial");
    }
  });
});

describe("I-2: el ROAS de la tabla semanal es el de la cohorte de registro", () => {
  it("una venta de la semana 2 de alguien registrado en la semana 1 cuenta en la semana 1, como en la tabla por campaña", async () => {
    await gasto("2026-10-05", "400000"); // USD 100
    await personaDePaid("2026-10-05", { diaVenta: "2026-10-13", valor: "200" });
    const [vista, roas] = await Promise.all([
      cargarPautaSemanal(db, { programId, rango: DOS_SEMANAS, hoy: HOY, cohorteId: null }),
      cargarRoasDePauta(db, programId, SEMANA_1, HOY, AHORA),
    ]);
    expect(roas.total.roas.valor).toBe(2);
    expect(fila(vista, "roas").celdas.porSemana[0].valor).toBe(roas.total.roas.valor);
  });
});

describe("I-8: una semana sin gasto cargado no muestra inversión 0", () => {
  it("la inversión de una semana sin filas de gasto es «—» con el motivo, no 0", async () => {
    await gasto("2026-10-05", "400000");
    const vista = await cargarPautaSemanal(db, { programId, rango: DOS_SEMANAS, hoy: HOY, cohorteId: null });
    const semana2 = fila(vista, "inversion").celdas.porSemana[1];
    expect(semana2.valor).toBeNull();
    expect(semana2.cobertura.estado).toBe("sin_dato");
    expect(semana2.cobertura.razon).toContain("Gasto de Meta");
  });
});

describe("el filtro de cohorte y el área llegan igual a todas las superficies", () => {
  async function cohorte(codigo: string, inicio: string, cierre: string) {
    return (await db.insert(cohorts).values({
      programId, codigo, metaCupos: 10, precioUsd: "1000", fechaInicioVentas: inicio,
      fechaCierreVentas: cierre, fechaInicioClases: "2027-01-10", estado: "cerrado",
    }).returning())[0].id;
  }

  it("con cohorte elegida, el ROAS de la tabla semanal es el de esa cohorte (no «—») y coincide con la tabla por campaña", async () => {
    const c1 = await cohorte("C1", "2026-09-01", "2026-10-31");
    const c2 = await cohorte("C2", "2026-11-01", "2026-12-31");
    await gasto("2026-10-05", "400000"); // USD 100
    await personaDePaid("2026-10-05", { diaVenta: "2026-10-13", valor: "200" }, { cohortId: c1 });
    await personaDePaid("2026-10-05", { diaVenta: "2026-10-13", valor: "400" }, { cohortId: c2 });
    const vista = await cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: c1 });
    const roas = await cargarRoasDePauta(db, programId, SEMANA_1, HOY, AHORA, c1);
    expect(roas.total.roas.valor).toBe(2);
    expect(total(vista, "roas").valor).toBe(2);
    expect(total(vista, "profit").valor).toBe(100);
    expect((await cargarRoasDePauta(db, programId, SEMANA_1, HOY, AHORA)).total.roas.valor).toBe(6);
  });

  it("una cita de Orgánico no entra al grupo de Paid de la tabla semanal", async () => {
    await cita((await personaDePaid("2026-10-05", { diaVenta: "2026-10-08", valor: "200" })).id, "2026-10-06", "show");
    await cita((await personaDePaid("2026-10-05", undefined, { medio: "organic" })).id, "2026-10-06", "no_show");
    const vista = await cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: null });
    expect(total(vista, "show").valor).toBe(1);
    expect(total(vista, "agenda_venta").valor).toBe(1);
    const todas = await grupoDeCitas(db, { programId, rango: SEMANA_1, ahora: AHORA });
    expect(todas.tasas.razonShow.valor).toBe(0.5);
  });
});
