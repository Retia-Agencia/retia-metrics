import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  calls, cuentasPublicitarias, deals, dealEtapaHistorial, gastoPauta, leads, pautaObjetos, programs, sources,
  submissions, tasasCambio,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cop, num, pct, usd } from "@/lib/format";
import { csvDePautaSemanal } from "@/lib/pauta/csv-tabla-semanal";
import { cargarPautaSemanal, type ClavePautaSemanal, type VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";
import { VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * NUMEROS DORADOS DE PAUTA (ticket 403 F3/F4, ADR 0115 N2): gasto, ROAS, costo por agenda del Hub y del semáforo y el
 * CSV de la tabla semanal, sobre una base sembrada y determinista. Los esperados están escritos A MANO desde la
 * semilla de abajo; ninguno se copió de la salida. Cambiar una fórmula o la semilla obliga a editarlos en el mismo commit.
 *
 * Semilla (programa de ticket USD 1.000, TRM 4.000 todo el rango, semana del 5 al 11 de octubre de 2026, hoy 18-oct):
 *   gasto Paid: los 7 días de la semana, COP 400.000 cada día = COP 2.800.000 = USD 700. (Los 7 días tienen fila: un día
 *   sin fila entre el primero y el último cargado no cuenta como cubierto y el costo sale «—», por diseño.)
 *   Meta: 2 agendas por día = 14. El 5-oct además informa 20.000 impresiones, 400 clics al enlace y 200 vistas de la landing.
 *   CRM: 4 envíos Paid el 5-oct (4 registros), 4 citas creadas en la semana, 1 venta de USD 1.400 el 8-oct.
 *
 *   inversión        = COP 2.800.000
 *   agendas          = 4                       ventas = 1          facturación (vendido) = USD 1.400
 *   costo por agenda (CRM, Hub)       = 2.800.000 ÷ 4 = COP 700.000
 *   costo por agenda (según Meta)     = 2.800.000 ÷ 14 = COP 200.000
 *   ROAS             = 1.400 ÷ 700 = 2         profit = 1.400 − 700 = USD 700
 *   CPM              = 400.000 ÷ 20.000 × 1.000 = COP 20.000 (solo la fila con impresiones)
 *   CTR              = 400 ÷ 20.000 = 2 %      llegada a la landing = 200 ÷ 400 = 50 %
 *   conversión de la landing = 4 registros ÷ 200 vistas = 2 %
 *   frecuencia       = «—» (el alcance no es aditivo en más de un día)
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let anuncioId: string;
let secuencia = 0;

const SEMANA_1 = { desde: "2026-10-05", hasta: "2026-10-11" };
const HOY = "2026-10-18";

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "dorado-pauta", nombre: "Dorado Pauta", ticketUsd: "1000" }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId, idMeta: "dor-cuenta", nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "par-campana", nivel: "campana", nombre: "Campaña", estado: "ACTIVE", proposito: "agenda" },
    { cuentaId: cuenta.id, programId, idMeta: "par-conjunto", nivel: "conjunto", padreIdMeta: "par-campana", nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "par-anuncio", nivel: "anuncio", padreIdMeta: "par-conjunto", nombre: "Anuncio", estado: "ACTIVE" },
  ]).returning();
  anuncioId = objetos.find((o) => o.nivel === "anuncio")!.id;
  await db.insert(tasasCambio).values({ vigenteDesde: "2026-09-28", vigenteHasta: "2026-10-18", pesosPorDolar: "4000", fuente: "prueba" });

  await db.insert(gastoPauta).values([
    { programId, fecha: "2026-10-05", monto: "400000", moneda: "COP", origen: "meta_api", pautaObjetoId: anuncioId,
      agendasMeta: 2, impresiones: 20000, clicsEnlace: 400, vistasLanding: 200 },
    ...["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"].map((fecha) => (
      { programId, fecha, monto: "400000", moneda: "COP", origen: "meta_api" as const, pautaObjetoId: anuncioId, agendasMeta: 2 })),
  ]);

  // 4 envíos Paid el 5-oct; el primero se vende el 8-oct por USD 1.400 y los cuatro tienen cita creada en la semana.
  const vendida = await personaDePaid("2026-10-05", { diaVenta: "2026-10-08", valor: "1400" });
  const segunda = await personaDePaid("2026-10-05");
  const tercera = await personaDePaid("2026-10-05");
  const cuarta = await personaDePaid("2026-10-05");
  await cita(cuarta.id, "2026-10-08", "show");
  await cita(vendida.id, "2026-10-06", "show");
  await cita(segunda.id, "2026-10-07", "show");
  await cita(tercera.id, "2026-10-07", "no_show");
});

async function personaDePaid(dia: string, venta?: { diaVenta: string; valor: string }) {
  const lead = (await db.insert(leads).values({
    programId, fechaPrimeraAplicacion: new Date(`${dia}T10:00:00-05:00`),
    emailNormalizado: `dorado-pauta-${++secuencia}@test.co`, nombre: `Lead ${secuencia}`,
  }).returning())[0];
  const envio = (await db.insert(submissions).values({
    sourceId, leadId: lead.id, token: crypto.randomUUID(), esParcial: false,
    fechaEnvio: new Date(`${dia}T10:00:00-05:00`), createdAt: new Date(`${dia}T10:00:00-05:00`),
    utmSource: "facebook", utmMedium: "cpc", utmId: "par-anuncio",
  }).returning())[0];
  const deal = (await db.insert(deals).values({
    programId, leadId: lead.id, submissionOrigenId: envio.id,
    ownerUserId: venta ? await duenoDePrueba(db, programId) : null,
    etapa: venta ? "ganado_completo" : "agendado",
    valorVendidoUsd: venta ? venta.valor : null,
  }).returning())[0];
  if (venta) {
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date(`${venta.diaVenta}T12:00:00-05:00`) });
  }
  return deal;
}

async function cita(dealId: string, dia: string, resultado: "show" | "no_show") {
  await db.insert(calls).values({
    programId, dealId, resultado,
    fechaAgenda: new Date(`${dia}T11:00:00-05:00`), createdAt: new Date(`${dia}T09:00:00-05:00`),
  });
}

const fila = (v: VistaPautaSemanal, clave: ClavePautaSemanal) => v.filas.find((f) => f.clave === clave)!;
const total = (v: VistaPautaSemanal, clave: ClavePautaSemanal) => fila(v, clave).celdas.total;
const vista = () => cargarPautaSemanal(db, { programId, rango: SEMANA_1, hoy: HOY, cohorteId: null });

describe("dorado de Pauta: la tabla semanal", () => {
  it("cada fila da lo escrito a mano", async () => {
    const v = await vista();
    expect(total(v, "inversion").valor).toBe(2_800_000);
    expect(total(v, "agendas").valor).toBe(4);
    expect(total(v, "ventas").valor).toBe(1);
    expect(total(v, "facturacion").valor).toBe(1400);
    expect(total(v, "costo_agenda_crm").valor).toBe(700_000);
    expect(total(v, "roas").valor).toBe(2);
    expect(total(v, "profit").valor).toBe(700);
    expect(total(v, "cpm").valor).toBe(20_000);
    expect(total(v, "ctr").valor).toBeCloseTo(0.02);
    expect(total(v, "llegada_landing").valor).toBeCloseTo(0.5);
    expect(total(v, "conversion_landing").valor).toBeCloseTo(0.02);
    expect(total(v, "frecuencia").valor).toBeNull();
  });

  it("la semana y el total coinciden (hay una sola semana)", async () => {
    const v = await vista();
    for (const clave of ["inversion", "agendas", "ventas", "roas", "profit", "costo_agenda_crm"] as const) {
      expect(fila(v, clave).celdas.porColumna[0].valor, clave).toBe(total(v, clave).valor);
    }
  });
});

describe("dorado de Pauta: ROAS y semáforo", () => {
  it("el ROAS de la tabla por campaña es el de la tabla semanal: 2", async () => {
    const roas = await cargarRoasDePauta(db, programId, SEMANA_1, HOY, new Date("2026-10-18T23:59:59-05:00"));
    expect(roas.total.roas.valor).toBe(2);
  });

  it("el costo por agenda del semáforo usa las agendas de Meta (14) y no las del CRM (4): COP 200.000", async () => {
    const costo = await costoPorAgendaDeVentana(db, { programId, desde: SEMANA_1.desde, hasta: SEMANA_1.hasta });
    expect(costo.gasto).toBe(2_800_000);
    expect(costo.agendasMeta).toBe(14);
    expect(costo.agendasCrm).toBe(4);
    expect(costo.costo).toBe(200_000);
  });
});

describe("dorado de Pauta: el CSV", () => {
  it("trae las mismas filas y valores que la tabla, con el nombre del vocabulario", async () => {
    const csv = csvDePautaSemanal(await vista());
    // Las celdas con coma van entre comillas («USD 700,00»): se separan respetándolas.
    const celdas = (linea: string) => [...linea.matchAll(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)].map((m) => m[1].replace(/^"|"$/g, "").replaceAll('""', '"')).slice(0, -1);
    const filas = csv.replace(/^﻿/, "").trim().split("\r\n").map(celdas);
    const celdaTotal = (nombre: string) => filas.find((f) => f[0] === nombre)?.[1];
    expect(filas[0].slice(0, 2)).toEqual(["Métrica", "Total"]);
    expect(celdaTotal(VOCABULARIO_PAUTA_SEMANAL.inversion)).toBe(cop(2_800_000));
    expect(celdaTotal(VOCABULARIO_PAUTA_SEMANAL.profit)).toBe(usd(700));
    expect(celdaTotal(VOCABULARIO_PAUTA_SEMANAL.roas)).toBe(`${num(2, 2)}×`);
    expect(celdaTotal(VOCABULARIO_PAUTA_SEMANAL.ctr)).toBe(pct(0.02));
    expect(celdaTotal(VOCABULARIO_PAUTA_SEMANAL.frecuencia)).toBe("—");
  });
});
