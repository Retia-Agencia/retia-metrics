/**
 * 416 — Pauta por cuenta. La suma de las cuentas es el total del programa, en las tres superficies que cortan por
 * cuenta (las subfilas de la tabla de Pauta, «Ver por Cuenta» de «¿Qué trae ventas?» y la dimensión `cuenta` del
 * hecho de gasto, que usará «Ver solo»), y las tres dicen lo mismo de cada cuenta porque resuelven la cuenta de un
 * gasto en el mismo lugar: el objeto de pauta del gasto y su `cuenta_id`. Una cuenta de otro programa nunca aparece.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  calls,
  cuentasPublicitarias,
  dealEtapaHistorial,
  deals,
  gastoPauta,
  leads,
  pautaObjetos,
  programs,
  sources,
  submissions,
  tasasCambio,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import * as hechoGasto from "@/lib/queries/hechos/gasto";
import { cargarPautaSemanal, type ClavePautaSemanal, type VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { cargarRoasDePauta, filtrarEnviosDePauta, SIN_CUENTA } from "@/lib/queries/roas-de-pauta";
import { filasDeQueTraeVentas } from "@/lib/pauta/cifras-de-origen";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let secuencia = 0;
const cuentas: Record<string, { id: string; anuncio: string }> = {};

const RANGO = { desde: "2026-10-05", hasta: "2026-10-18" };
const HOY = "2026-10-18";
const AHORA = new Date("2026-10-18T23:59:59-05:00");

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

async function crearCuenta(programa: string, prefijo: string, nombre: string, moneda: "COP" | "USD") {
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId: programa, idMeta: `${prefijo}-cuenta`, nombre, moneda, zonaHoraria: "America/Bogota",
  }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId: programa, idMeta: `${prefijo}-campana`, nivel: "campana", nombre: `Campaña ${nombre}`, estado: "ACTIVE", proposito: "agenda" },
    { cuentaId: cuenta.id, programId: programa, idMeta: `${prefijo}-conjunto`, nivel: "conjunto", padreIdMeta: `${prefijo}-campana`, nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programa, idMeta: `${prefijo}-anuncio`, nivel: "anuncio", padreIdMeta: `${prefijo}-conjunto`, nombre: "Anuncio", estado: "ACTIVE" },
  ]).returning();
  cuentas[prefijo] = { id: cuenta.id, anuncio: objetos.find((o) => o.nivel === "anuncio")!.id };
}

async function gasto(args: { programa?: string; dia: string; monto: string; moneda?: "COP" | "USD"; cuenta?: string; agendasMeta?: number }) {
  await db.insert(gastoPauta).values({
    programId: args.programa ?? programId,
    fecha: args.dia,
    monto: args.monto,
    moneda: args.moneda ?? "COP",
    origen: args.cuenta ? "meta_api" : "manual",
    pautaObjetoId: args.cuenta ? cuentas[args.cuenta].anuncio : null,
    area: args.cuenta ? null : "paid",
    agendasMeta: args.agendasMeta,
  });
}

/** Un envío de pauta con su deal y una cita; `utmId` nulo = pauta sin anuncio identificado. */
async function lead(dia: string, utmId: string | null, venta = false) {
  const persona = (await db.insert(leads).values({
    programId, fechaPrimeraAplicacion: new Date(`${dia}T10:00:00-05:00`),
    emailNormalizado: `por-cuenta-${++secuencia}@test.co`, nombre: `Lead ${secuencia}`,
  }).returning())[0];
  const envio = (await db.insert(submissions).values({
    sourceId, leadId: persona.id, token: crypto.randomUUID(), esParcial: false,
    fechaEnvio: new Date(`${dia}T10:00:00-05:00`), createdAt: new Date(`${dia}T10:00:00-05:00`),
    utmSource: "facebook", utmMedium: "cpc", utmId,
  }).returning())[0];
  const deal = (await db.insert(deals).values({
    programId, leadId: persona.id, submissionOrigenId: envio.id,
    ownerUserId: venta ? await duenoDePrueba(db, programId) : null,
    etapa: venta ? "ganado_completo" : "agendado", valorVendidoUsd: venta ? "300" : null,
  }).returning())[0];
  if (venta) await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date(`${dia}T12:00:00-05:00`) });
  await db.insert(calls).values({
    programId, dealId: deal.id, resultado: "show",
    fechaAgenda: new Date(`${dia}T11:00:00-05:00`), createdAt: new Date(`${dia}T09:00:00-05:00`),
  });
}

beforeEach(async () => {
  await vaciar();
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "por-cuenta", nombre: "Por cuenta", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro-por-cuenta", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  programId = programas[0].id;
  otroProgramId = programas[1].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  await db.insert(tasasCambio).values({ vigenteDesde: "2026-10-01", vigenteHasta: "2026-10-31", pesosPorDolar: "4000", fuente: "prueba" });
  await crearCuenta(programId, "rosario", "Rosario", "COP");
  await crearCuenta(programId, "milena", "Milena", "USD");
  await crearCuenta(otroProgramId, "ajena", "Ajena", "COP");

  await gasto({ dia: "2026-10-06", monto: "400000", cuenta: "rosario", agendasMeta: 2 });
  await gasto({ dia: "2026-10-13", monto: "300000", cuenta: "rosario", agendasMeta: 1 });
  await gasto({ dia: "2026-10-14", monto: "50", moneda: "USD", cuenta: "milena", agendasMeta: 1 });
  await gasto({ dia: "2026-10-07", monto: "100000" });
  await gasto({ programa: otroProgramId, dia: "2026-10-06", monto: "999000", cuenta: "ajena", agendasMeta: 9 });

  await lead("2026-10-06", "rosario-anuncio", true);
  await lead("2026-10-13", "rosario-anuncio");
  await lead("2026-10-14", "milena-anuncio", true);
  await lead("2026-10-08", null);
});

const fila = (vista: VistaPautaSemanal, clave: ClavePautaSemanal) => vista.filas.find((f) => f.clave === clave)!;
const suma = (valores: Array<number | null>) => valores.reduce<number>((n, v) => n + (v ?? 0), 0);

describe("416 · la tabla de Pauta por cuenta", () => {
  it("sin el interruptor no trae subfilas", async () => {
    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });
    expect(vista.filas.every((f) => f.subfilas === undefined)).toBe(true);
  });

  it("Inversión y Agendas según Meta: la suma de las cuentas es el total, en el Total y en cada columna", async () => {
    for (const paso of ["semana", "dia"] as const) {
      const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null, paso, porCuenta: true });
      for (const clave of ["inversion", "agendas_meta"] as const) {
        const f = fila(vista, clave);
        const subfilas = f.subfilas!;
        expect(suma(subfilas.map((s) => s.celdas.total.valor))).toBe(f.celdas.total.valor);
        f.celdas.porColumna.forEach((celda, i) => {
          expect(suma(subfilas.map((s) => s.celdas.porColumna[i].valor)), `${paso} ${clave} columna ${i}`).toBe(celda.valor ?? 0);
        });
      }
    }
  });

  it("cada cuenta trae lo suyo, el gasto a mano va aparte y la cuenta de otro programa no aparece", async () => {
    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null, porCuenta: true });
    const inversion = fila(vista, "inversion").subfilas!;
    expect(inversion.map((s) => [s.nombre, s.celdas.total.valor])).toEqual([
      ["Rosario", 700_000],
      ["Milena", 200_000],
      ["Sin cuenta de Meta", 100_000],
    ]);
    expect(fila(vista, "inversion").celdas.total.valor).toBe(1_000_000);
    // El costo de un periodo con días sin gasto cargado no se calcula (N3), igual que la fila; con días cubiertos, sí.
    expect(fila(vista, "costo_agenda_meta").celdas.total.valor).toBeNull();
    expect(fila(vista, "costo_agenda_meta").subfilas!.every((s) => s.celdas.total.valor === null)).toBe(true);
    const cubierto = await cargarPautaSemanal(db, { programId, rango: { desde: "2026-10-13", hasta: "2026-10-14" }, hoy: HOY, cohorteId: null, porCuenta: true });
    const costo = fila(cubierto, "costo_agenda_meta").subfilas!;
    expect(costo.find((s) => s.nombre === "Rosario")!.celdas.total.valor).toBe(300_000);
    expect(costo.find((s) => s.nombre === "Rosario")!.celdas.total.partes).toEqual([300_000, 1]);
    expect(costo.find((s) => s.nombre === "Milena")!.celdas.total.valor).toBe(200_000);
    expect(vista.filas.flatMap((f) => f.subfilas ?? []).some((s) => s.nombre === "Ajena")).toBe(false);
    // Solo las tres filas de Meta se abren por cuenta (diseño §4.3).
    expect(vista.filas.filter((f) => f.subfilas).map((f) => f.clave)).toEqual(["inversion", "agendas_meta", "costo_agenda_meta"]);
  });
});

describe("416 · «Ver por Cuenta» y la dimensión de cuenta del gasto", () => {
  it("las cuentas de «¿Qué trae ventas?» suman el total en inversión, agendadas y ventas", async () => {
    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY, AHORA);
    expect(suma(vista.cuentas.map((c) => c.gastoCop))).toBeCloseTo(vista.total.gastoCop!);
    expect(suma(vista.cuentas.map((c) => c.agendas))).toBe(vista.total.agendas);
    expect(suma(vista.cuentas.map((c) => c.ventas))).toBe(vista.total.ventas);
    expect(vista.cuentas.map((c) => [c.nombre, c.agendas, c.ventas])).toEqual([
      ["Rosario", 2, 1],
      ["Milena", 1, 1],
      ["Sin cuenta de Meta", 1, 0],
    ]);
  });

  it("una cuenta con inversión en pesos aparece aunque falte la TRM para pasarla a dólares", async () => {
    // Sin envíos (la cuenta solo se ve por su gasto) y sin TRM (su gasto en dólares queda en 0).
    await db.delete(tasasCambio);
    for (const tabla of [calls, dealEtapaHistorial, deals, submissions]) await db.delete(tabla);
    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY, AHORA);
    expect(vista.cuentas.map((c) => c.nombre)).toContain("Rosario");
  });

  it("la tabla y «Ver por Cuenta» dicen la misma inversión de cada cuenta", async () => {
    const [tabla, roas] = await Promise.all([
      cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null, porCuenta: true }),
      cargarRoasDePauta(db, programId, RANGO, HOY, AHORA),
    ]);
    const deLaTabla = Object.fromEntries(fila(tabla, "inversion").subfilas!.map((s) => [s.cuentaId ?? SIN_CUENTA, s.celdas.total.valor]));
    for (const c of roas.cuentas) expect(c.gastoCop, c.nombre).toBeCloseTo(deLaTabla[c.id!]!);
  });

  it("la lista de una cuenta son los envíos de esa cuenta, y las filas de Ver por Cuenta son Cifras", async () => {
    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY, AHORA);
    const rosario = vista.cuentas.find((c) => c.nombre === "Rosario")!;
    expect(filtrarEnviosDePauta(vista.envios, "cuenta_meta", rosario.id!)).toHaveLength(2);
    expect(filtrarEnviosDePauta(vista.envios, "cuenta_meta", SIN_CUENTA)).toHaveLength(1);
    const filas = filasDeQueTraeVentas({ vista, periodo: "del 5 al 18 oct" }, "cuenta");
    expect(filas.map((f) => f.nombre)).toEqual(["Total Paid", "Rosario", "Milena", "Sin cuenta de Meta"]);
    expect(filas[1].inversion.valor).toBe(700_000);
  });

  it("el hecho de gasto agrupa y filtra por cuenta (lo que usará «Ver solo»)", async () => {
    const grupos = await hechoGasto.agrupar<"cuenta_meta">(db, { programId, rango: RANGO, agruparPor: ["cuenta_meta"] }) as unknown as Array<{ cuenta_meta: string | null; moneda: string; monto: number }>;
    const porCuenta = (id: string | null, moneda: string) => grupos.filter((g) => g.cuenta_meta === id && g.moneda === moneda).reduce((n, g) => n + g.monto, 0);
    expect(porCuenta(cuentas.rosario.id, "COP")).toBe(700_000);
    expect(porCuenta(cuentas.milena.id, "USD")).toBe(50);
    expect(porCuenta(null, "COP")).toBe(100_000);
    expect(grupos.some((g) => g.cuenta_meta === cuentas.ajena.id)).toBe(false);
    const soloRosario = await hechoGasto.listar<"cuenta_meta">(db, { programId, rango: RANGO, filtros: { cuenta_meta: [cuentas.rosario.id] }, pagina: { limite: 50, offset: 0 } });
    expect(soloRosario.total).toBe(2);
  });
});
