import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  cuentasPublicitarias,
  deals,
  dealEtapaHistorial,
  gastoPauta,
  leads,
  pautaObjetos,
  programs,
  sources,
  submissions,
  tasasCambio,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cargarPautaSemanal, type ClavePautaSemanal, type VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { leerEvidencia, leerEvidenciaDeVentas } from "@/lib/metas/cumplimiento-de-cohorte";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let sourceOtroId: string;
let anuncioId: string;
let anuncioOtroId: string;
let actorId: string;
let secuencia = 0;

const RANGO = { desde: "2026-10-05", hasta: "2026-10-18" };
const HOY = "2026-10-18";

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "pauta-semanal", nombre: "Pauta semanal", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro-pauta-semanal", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  programId = programas[0].id;
  otroProgramId = programas[1].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  sourceOtroId = (await db.insert(sources).values({ programId: otroProgramId, nombre: "Formulario otro" }).returning())[0].id;
  actorId = (await db.insert(users).values({ email: `pauta-${++secuencia}@retia.test`, rol: "developer" }).returning())[0].id;
  anuncioId = await crearArbol(programId, "pauta");
  anuncioOtroId = await crearArbol(otroProgramId, "otro");
  await db.insert(tasasCambio).values([
    { vigenteDesde: "2026-10-05", vigenteHasta: "2026-10-11", pesosPorDolar: "4000", fuente: "prueba" },
    { vigenteDesde: "2026-10-12", vigenteHasta: "2026-10-18", pesosPorDolar: "4000", fuente: "prueba" },
  ]);
});
afterAll(async () => cerrar());

async function crearArbol(programa: string, prefijo: string): Promise<string> {
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId: programa,
    idMeta: `${prefijo}-cuenta`,
    nombre: `Cuenta ${prefijo}`,
    moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId: programa, idMeta: `${prefijo}-campana`, nivel: "campana", nombre: "Campaña", estado: "ACTIVE", proposito: "agenda" },
    { cuentaId: cuenta.id, programId: programa, idMeta: `${prefijo}-conjunto`, nivel: "conjunto", padreIdMeta: `${prefijo}-campana`, nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programa, idMeta: `${prefijo}-anuncio`, nivel: "anuncio", padreIdMeta: `${prefijo}-conjunto`, nombre: "Anuncio", estado: "ACTIVE" },
  ]).returning();
  return objetos.find((objeto) => objeto.nivel === "anuncio")!.id;
}

async function crearEnvio(programa = programId, dia = "2026-10-05") {
  const otro = programa === otroProgramId;
  const lead = (await db.insert(leads).values({
    programId: programa,
    fechaPrimeraAplicacion: new Date(`${dia}T10:00:00-05:00`),
    emailNormalizado: `pauta-semanal-${++secuencia}@test.co`,
    nombre: `Lead ${secuencia}`,
  }).returning())[0];
  const envio = (await db.insert(submissions).values({
    sourceId: otro ? sourceOtroId : sourceId,
    leadId: lead.id,
    token: crypto.randomUUID(),
    esParcial: false,
    fechaEnvio: new Date(`${dia}T10:00:00-05:00`),
    createdAt: new Date(`${dia}T10:00:00-05:00`),
    utmSource: "facebook",
    utmMedium: "cpc",
    utmId: otro ? "otro-anuncio" : "pauta-anuncio",
  }).returning())[0];
  return { programa, leadId: lead.id, envioId: envio.id };
}

async function crearDeal(
  envio: Awaited<ReturnType<typeof crearEnvio>>,
  opciones: { venta?: boolean; valor?: string; diaVenta?: string; anulado?: boolean } = {},
) {
  const anulado = opciones.anulado ?? false;
  const deal = (await db.insert(deals).values({
    programId: envio.programa,
    leadId: envio.leadId,
    submissionOrigenId: envio.envioId,
    ownerUserId: opciones.venta ? await duenoDePrueba(db, envio.programa) : null,
    etapa: opciones.venta ? "ganado_completo" : "agendado",
    valorVendidoUsd: opciones.venta ? opciones.valor ?? "200" : null,
    anuladoEn: anulado ? new Date("2026-10-06T12:00:00-05:00") : null,
    anuladoPor: anulado ? actorId : null,
    motivoAnulacion: anulado ? "Duplicado" : null,
  }).returning())[0];
  if (opciones.venta) {
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      a: "ganado_completo",
      fecha: new Date(`${opciones.diaVenta ?? "2026-10-05"}T12:00:00-05:00`),
    });
  }
  return deal;
}

async function crearCita(dealId: string, dia: string, resultado: "show" | "no_show" = "show", anulada = false) {
  return (await db.insert(calls).values({
    programId,
    dealId,
    resultado,
    fechaAgenda: new Date(`${dia}T11:00:00-05:00`),
    createdAt: new Date(`${dia}T09:00:00-05:00`),
    anuladoEn: anulada ? new Date(`${dia}T13:00:00-05:00`) : null,
    anuladoPor: anulada ? actorId : null,
    motivoAnulacion: anulada ? "Duplicada" : null,
  }).returning())[0];
}

async function gasto(args: {
  programa?: string;
  dia: string;
  monto: string;
  moneda?: "COP" | "USD";
  impresiones?: number | null;
  clics?: number | null;
  landing?: number | null;
  alcance?: number | null;
  agendasMeta?: number | null;
  manual?: boolean;
}) {
  const otro = args.programa === otroProgramId;
  await db.insert(gastoPauta).values({
    programId: args.programa ?? programId,
    fecha: args.dia,
    monto: args.monto,
    moneda: args.moneda ?? "COP",
    origen: args.manual ? "manual" : "meta_api",
    pautaObjetoId: args.manual ? null : otro ? anuncioOtroId : anuncioId,
    area: args.manual ? "paid" : null,
    impresiones: args.impresiones,
    clicsEnlace: args.clics,
    vistasLanding: args.landing,
    alcance: args.alcance,
    agendasMeta: args.agendasMeta,
  });
}

const fila = (vista: VistaPautaSemanal, clave: ClavePautaSemanal) => vista.filas.find((f) => f.clave === clave)!;
const total = (vista: VistaPautaSemanal, clave: ClavePautaSemanal) => fila(vista, clave).celdas.total.valor;

async function escenarioManual() {
  await gasto({ dia: "2026-10-05", monto: "400000", impresiones: 10_000, clics: 200, landing: 100, alcance: 5_000, agendasMeta: 4 });
  const envioVenta = await crearEnvio(programId, "2026-10-05");
  const venta = await crearDeal(envioVenta, { venta: true, valor: "200", diaVenta: "2026-10-05" });
  const envioAbierto = await crearEnvio(programId, "2026-10-05");
  const abierto = await crearDeal(envioAbierto);
  await crearCita(venta.id, "2026-10-05", "show");
  await crearCita(abierto.id, "2026-10-05", "no_show");
}

describe("tabla semanal de Paid Media", () => {
  it("cuadra una semana hecha a mano y deja la semana sin gasto con costos no calculables", async () => {
    await escenarioManual();
    const dia = { desde: "2026-10-05", hasta: "2026-10-05" };
    const vista = await cargarPautaSemanal(db, { programId, rango: dia, hoy: HOY, cohorteId: null });

    expect(vista.columnas).toEqual([dia]);
    expect(total(vista, "inversion")).toBe(400_000);
    expect(total(vista, "agendas")).toBe(2);
    expect(total(vista, "ventas")).toBe(1);
    expect(total(vista, "facturacion")).toBe(200);
    expect(total(vista, "roas")).toBe(2);
    expect(total(vista, "profit")).toBe(100);
    expect(total(vista, "show")).toBe(0.5);
    expect(total(vista, "cierre_ventas")).toBe(1);
    expect(total(vista, "agenda_venta")).toBe(0.5);
    expect(total(vista, "cpm")).toBe(40_000);
    expect(total(vista, "ctr")).toBe(0.02);
    expect(total(vista, "llegada_landing")).toBe(0.5);
    expect(total(vista, "conversion_landing")).toBe(0.02);
    expect(total(vista, "costo_agenda_meta")).toBe(100_000);
    expect(total(vista, "frecuencia")).toBe(2);

    const dosSemanas = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });
    expect(dosSemanas.columnas).toEqual([
      { desde: "2026-10-05", hasta: "2026-10-11" },
      { desde: "2026-10-12", hasta: "2026-10-18" },
    ]);
    expect(fila(dosSemanas, "agendas").celdas.porColumna[1].valor).toBe(0);
    expect(fila(dosSemanas, "costo_agenda_meta").celdas.porColumna[1].valor).toBeNull();
  });

  it("las filas aditivas suman sus semanas y Total recalcula las razones", async () => {
    await escenarioManual();
    await gasto({ dia: "2026-10-12", monto: "200000", impresiones: 4_000, clics: 80, landing: 40, alcance: 2_000, agendasMeta: 2 });
    const envio = await crearEnvio(programId, "2026-10-12");
    const venta = await crearDeal(envio, { venta: true, valor: "100", diaVenta: "2026-10-12" });
    await crearCita(venta.id, "2026-10-12", "show");
    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });

    for (const clave of ["inversion", "agendas", "ventas", "facturacion"] as const) {
      expect(fila(vista, clave).celdas.porColumna.reduce((n, celda) => n + (celda.valor ?? 0), 0)).toBe(total(vista, clave));
    }
    expect(total(vista, "roas")).toBeCloseTo(2);
  });

  it("no mezcla dos monedas cuando falta la TRM", async () => {
    await db.delete(tasasCambio);
    await gasto({ dia: "2026-10-05", monto: "100000", moneda: "COP" });
    await gasto({ dia: "2026-10-05", monto: "25", moneda: "USD", manual: true });

    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });
    expect(fila(vista, "inversion").celdas.total).toMatchObject({
      valor: null,
      cobertura: { estado: "sin_dato" },
    });
    expect(fila(vista, "inversion").celdas.total.cobertura.razon).toContain("TRM");
  });

  it("mantiene el programa como frontera y excluye llamada, deal y abono anulados", async () => {
    await escenarioManual();
    await gasto({ programa: otroProgramId, dia: "2026-10-05", monto: "999999", impresiones: 1, clics: 1, landing: 1, alcance: 1, agendasMeta: 1 });
    const envioOtro = await crearEnvio(otroProgramId, "2026-10-05");
    await crearDeal(envioOtro, { venta: true, valor: "999", diaVenta: "2026-10-05" });
    const envioAnulado = await crearEnvio(programId, "2026-10-05");
    const dealAnulado = await crearDeal(envioAnulado, { venta: true, valor: "500", diaVenta: "2026-10-05", anulado: true });
    await crearCita(dealAnulado.id, "2026-10-05", "show", true);
    await db.insert(abonos).values({
      programId,
      dealId: dealAnulado.id,
      fecha: "2026-10-05",
      monto: "500",
      moneda: "USD",
      concepto: "ticket",
      anuladoEn: new Date("2026-10-06T12:00:00-05:00"),
      anuladoPor: actorId,
      motivoAnulacion: "Duplicado",
    });

    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });
    expect(total(vista, "inversion")).toBe(400_000);
    expect(total(vista, "agendas")).toBe(2);
    expect(total(vista, "ventas")).toBe(1);
    expect(total(vista, "facturacion")).toBe(200);
  });

  it("reconcilia inversión, ventas y ROAS con cargarRoasDePauta", async () => {
    await escenarioManual();
    const [semanal, roas] = await Promise.all([
      cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null }),
      cargarRoasDePauta(db, programId, RANGO, HOY, new Date("2026-10-18T23:59:59-05:00")),
    ]);

    expect(total(semanal, "inversion")! / 4_000).toBe(roas.total.gastoUsd);
    expect(total(semanal, "ventas")).toBe(roas.total.ventas);
    expect(total(semanal, "roas")).toBe(roas.total.roas.valor);
  });
  it("419: cada razón trae las partes de su fórmula, y las partes dan el valor de la celda", async () => {
    await escenarioManual();
    const dia = { desde: "2026-10-05", hasta: "2026-10-05" };
    const vista = await cargarPautaSemanal(db, { programId, rango: dia, hoy: HOY, cohorteId: null });
    const partes = (clave: ClavePautaSemanal) => fila(vista, clave).celdas.total.partes;

    expect(partes("show")).toEqual([1, 2]);
    expect(partes("cierre_ventas")).toEqual([1, 1]);
    expect(partes("agenda_venta")).toEqual([1, 2]);
    expect(partes("roas")).toEqual([200, 100]);
    expect(partes("profit")).toEqual([200, 100]);
    expect(partes("cpm")).toEqual([400_000, 10_000]);
    expect(partes("ctr")).toEqual([200, 10_000]);
    expect(partes("llegada_landing")).toEqual([100, 200]);
    expect(partes("frecuencia")).toEqual([10_000, 5_000]);
    expect(partes("costo_agenda_meta")).toEqual([400_000, 4]);
    // Las partes reproducen la celda: si una consulta cambia una y no la otra, esto se pone rojo.
    for (const clave of ["show", "cierre_ventas", "agenda_venta", "roas", "ctr", "llegada_landing", "conversion_landing", "frecuencia", "costo_agenda_meta", "costo_agenda_crm"] as const) {
      const c = fila(vista, clave).celdas.total;
      if (c.valor === null) continue;
      const [a, b] = c.partes!;
      expect(a! / b!, clave).toBeCloseTo(c.valor, 10);
    }
    const cpm = fila(vista, "cpm").celdas.total;
    expect(cpm.partes![0]! / cpm.partes![1]! * 1_000).toBeCloseTo(cpm.valor!, 10);
    const profit = fila(vista, "profit").celdas.total;
    expect(profit.partes![0]! - profit.partes![1]!).toBe(profit.valor);
    // Una fila de conteo no lleva partes.
    expect(partes("ventas")).toBeUndefined();
  });

  it("419: la lista de ventas de cada columna cuenta lo mismo que las celdas Ventas y Vendido", async () => {
    // Semana 1: una venta de pauta, una orgánica (no cuenta), una anulada (no cuenta) y una de otro programa.
    await crearDeal(await crearEnvio(programId, "2026-10-05"), { venta: true, valor: "200", diaVenta: "2026-10-06" });
    const organico = await crearEnvio(programId, "2026-10-05");
    await db.update(submissions).set({ utmSource: "instagram", utmMedium: "organic", utmId: null }).where(eq(submissions.id, organico.envioId));
    await crearDeal(organico, { venta: true, valor: "900", diaVenta: "2026-10-06" });
    await crearDeal(await crearEnvio(programId, "2026-10-05"), { venta: true, valor: "500", diaVenta: "2026-10-07", anulado: true });
    await crearDeal(await crearEnvio(otroProgramId, "2026-10-05"), { venta: true, valor: "700", diaVenta: "2026-10-07" });
    // Semana 2: dos ventas de pauta, una registrada en la semana 1.
    await crearDeal(await crearEnvio(programId, "2026-10-05"), { venta: true, valor: "300", diaVenta: "2026-10-13" });
    await crearDeal(await crearEnvio(programId, "2026-10-12"), { venta: true, valor: "400", diaVenta: "2026-10-14" });

    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });
    const columnas = [RANGO, ...vista.columnas];
    const celdas = (clave: ClavePautaSemanal) => [fila(vista, clave).celdas.total, ...fila(vista, clave).celdas.porColumna];
    const ventas = celdas("ventas");
    const vendido = celdas("facturacion");
    expect(ventas.map((c) => c.valor)).toEqual([3, 1, 2]);
    for (const [i, rango] of columnas.entries()) {
      const lista = await leerEvidenciaDeVentas({ programId, cohorteId: null, desde: rango.desde, hasta: rango.hasta, hoy: HOY, area: "paid" }, db);
      expect(lista.subtotal.cantidad, `ventas ${rango.desde}`).toBe(ventas[i].valor);
      expect(lista.filas.reduce((n, f) => n + (f.monto ?? 0), 0), `vendido ${rango.desde}`).toBe(vendido[i].valor);
    }
  });
  it("419: Agendadas y la parte de arriba de cada tasa cuentan lo mismo que su lista, columna por columna", async () => {
    // Semana 1: dos citas de pauta (una asistió y compró), una sobre un deal anulado y una orgánica; semana 2: una que asistió.
    const vendido = await crearDeal(await crearEnvio(programId, "2026-10-05"), { venta: true, valor: "200", diaVenta: "2026-10-07" });
    await crearCita(vendido.id, "2026-10-06", "show");
    await crearCita((await crearDeal(await crearEnvio(programId, "2026-10-05"))).id, "2026-10-07", "no_show");
    await crearCita((await crearDeal(await crearEnvio(programId, "2026-10-05"), { anulado: true })).id, "2026-10-07", "show");
    const organico = await crearEnvio(programId, "2026-10-05");
    await db.update(submissions).set({ utmSource: "instagram", utmMedium: "organic", utmId: null }).where(eq(submissions.id, organico.envioId));
    await crearCita((await crearDeal(organico)).id, "2026-10-08", "show");
    await crearCita((await crearDeal(await crearEnvio(programId, "2026-10-12"))).id, "2026-10-13", "show");

    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: HOY, cohorteId: null });
    const columnas = [RANGO, ...vista.columnas];
    const celdas = (clave: ClavePautaSemanal) => [fila(vista, clave).celdas.total, ...fila(vista, clave).celdas.porColumna];
    const cuenta = async (metrica: Parameters<typeof leerEvidencia>[0], rango: { desde: string; hasta: string }) =>
      (await leerEvidencia(metrica, { programId, cohorteId: null, desde: rango.desde, hasta: rango.hasta, hoy: HOY, area: "paid" }, db)).subtotal.cantidad;
    expect(celdas("agendas").map((c) => c.valor)).toEqual([3, 2, 1]);
    for (const [i, rango] of columnas.entries()) {
      expect(await cuenta("agendas_creadas", rango), `agendas ${rango.desde}`).toBe(celdas("agendas")[i].valor);
      expect(await cuenta("grupo_shows", rango), `shows ${rango.desde}`).toBe(celdas("show")[i].partes?.[0] ?? 0);
      expect(await cuenta("grupo_vendidos", rango), `cierre ${rango.desde}`).toBe(celdas("cierre_ventas")[i].partes?.[0] ?? 0);
      expect(await cuenta("grupo_vendidos", rango), `cita a venta ${rango.desde}`).toBe(celdas("agenda_venta")[i].partes?.[0] ?? 0);
    }
  });
});

describe("414: la tabla de Pauta por día", () => {
  const SEMANA = { desde: "2026-10-05", hasta: "2026-10-11" };

  /**
   * Gasto todos los días (un día sin gasto cargado deja el costo de la semana en «—», 412 F), pero agendas y ventas
   * solo en tres, con días de cero en medio.
   */
  async function semanaDeVariosDias() {
    await gasto({ dia: "2026-10-05", monto: "400000", impresiones: 10_000, clics: 200, landing: 100, alcance: 5_000, agendasMeta: 4 });
    await gasto({ dia: "2026-10-07", monto: "100000", impresiones: 5_000, clics: 50, landing: 20, alcance: 3_000, agendasMeta: 1 });
    await gasto({ dia: "2026-10-09", monto: "60000", impresiones: 3_000, clics: 30, landing: 10, alcance: 2_000, agendasMeta: 2 });
    for (const dia of ["2026-10-06", "2026-10-08", "2026-10-10", "2026-10-11"]) {
      await gasto({ dia, monto: "10000", impresiones: 1_000, clics: 10, landing: 5, alcance: 800, agendasMeta: 0 });
    }
    const v1 = await crearDeal(await crearEnvio(programId, "2026-10-05"), { venta: true, valor: "200", diaVenta: "2026-10-05" });
    await crearCita(v1.id, "2026-10-05", "show");
    await crearCita((await crearDeal(await crearEnvio(programId, "2026-10-07"))).id, "2026-10-07", "no_show");
    const v3 = await crearDeal(await crearEnvio(programId, "2026-10-09"), { venta: true, valor: "150", diaVenta: "2026-10-09" });
    await crearCita(v3.id, "2026-10-09", "show");
  }

  it("una columna por día del periodo, y la suma de los días es la semana (conteos, dinero y las partes de cada razón)", async () => {
    await semanaDeVariosDias();
    const [porSemana, porDia] = await Promise.all([
      cargarPautaSemanal(db, { programId, rango: SEMANA, hoy: HOY, cohorteId: null }),
      cargarPautaSemanal(db, { programId, rango: SEMANA, hoy: HOY, cohorteId: null, paso: "dia" }),
    ]);
    expect(porDia.paso).toBe("dia");
    expect(porDia.columnas.map((c) => c.desde)).toEqual(
      ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"],
    );
    expect(porDia.columnas.every((c) => c.desde === c.hasta)).toBe(true);
    const semana = (clave: ClavePautaSemanal) => fila(porSemana, clave).celdas.porColumna[0];
    const dias = (clave: ClavePautaSemanal) => fila(porDia, clave).celdas.porColumna;

    // Conteos y dinero: la suma de los días es la semana, y el Total no depende del paso.
    for (const clave of ["inversion", "agendas", "agendas_meta", "ventas", "facturacion"] as const) {
      expect(dias(clave).reduce((n, c) => n + (c.valor ?? 0), 0), clave).toBe(semana(clave).valor);
      expect(fila(porDia, clave).celdas.total.valor, clave).toBe(fila(porSemana, clave).celdas.total.valor);
    }
    expect(semana("agendas_meta").valor).toBe(7);
    // Las razones no se suman: se suman sus partes y la razón de la semana sale de ellas.
    for (const clave of ["cpm", "ctr", "llegada_landing"] as const) {
      const sumaDe = (i: 0 | 1) => dias(clave).reduce((n, c) => n + (c.partes?.[i] ?? 0), 0);
      expect([sumaDe(0), sumaDe(1)], clave).toEqual(semana(clave).partes);
    }
    // Un día con 0 agendas no tiene costo (ni partes): el costo de la semana es el gasto de los días entre sus agendas.
    const suma = (clave: ClavePautaSemanal) => dias(clave).reduce((n, c) => n + (c.valor ?? 0), 0);
    expect(semana("costo_agenda_meta").partes).toEqual([suma("inversion"), suma("agendas_meta")]);
    expect(semana("costo_agenda_crm").partes).toEqual([suma("inversion"), suma("agendas")]);
    // Un día sin una sola agenda es cero, no «—»; un día sin gasto cargado sí es «—» con su motivo.
    expect(dias("agendas")[1].valor).toBe(0);
    const sinGasto = await cargarPautaSemanal(db, { programId, rango: { desde: "2026-10-12", hasta: "2026-10-13" }, hoy: HOY, cohorteId: null, paso: "dia" });
    expect(fila(sinGasto, "inversion").celdas.porColumna[0]).toMatchObject({ valor: null, cobertura: { estado: "sin_dato" } });
  });

  it("Agendas de Meta es una fila propia de Tráfico, con el mismo número que el denominador del costo según Meta", async () => {
    await semanaDeVariosDias();
    const vista = await cargarPautaSemanal(db, { programId, rango: SEMANA, hoy: HOY, cohorteId: null, paso: "dia" });
    const claves = vista.filas.filter((f) => f.bloque === "trafico").map((f) => f.clave);
    expect(claves.indexOf("agendas_meta")).toBe(claves.indexOf("costo_agenda_meta") - 1);
    expect(fila(vista, "agendas_meta").celdas.total.valor).toBe(fila(vista, "costo_agenda_meta").celdas.total.partes?.[1]);
    expect(fila(vista, "agendas_meta").nombre).toBe("Agendas de Meta");
  });

  it("la columna en curso marca Parcial las tasas de Comercial, también cuando cuadran", async () => {
    await semanaDeVariosDias();
    const hoy = "2026-10-09";
    const vista = await cargarPautaSemanal(db, { programId, rango: SEMANA, hoy, cohorteId: null, paso: "dia" });
    const enCurso = vista.columnas.findIndex((c) => c.hasta === hoy);
    for (const clave of ["show", "cierre_ventas", "agenda_venta"] as const) {
      const celda = fila(vista, clave).celdas.porColumna[enCurso];
      expect(celda.valor, clave).not.toBeNull();
      expect(celda.cobertura.estado, clave).toBe("parcial");
      // Un día ya cerrado no lleva la marca.
      expect(fila(vista, clave).celdas.porColumna[0].cobertura.estado, clave).toBe("ok");
    }
  });
});
