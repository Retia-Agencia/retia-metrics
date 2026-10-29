import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PautaRoas } from "@/components/pauta-roas";
import { abonos, calls, cuentasPublicitarias, deals, dealEtapaHistorial, gastoPauta, leads, pautaObjetos, programs, sources, submissions, tasasCambio, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { listaDeMetrica, proyectarParaPauta } from "@/lib/queries/metricas-con-filas";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { COLUMNAS_CSV_CITAS_PAUTA, csvDeCitasPauta } from "@/lib/pauta/csv-citas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { esAdministrador, veLeadsDePauta } from "@/lib/auth/roles";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let sourceOtro: string;
let actor: string;
let anuncioDbId: string;
let secuencia = 0;
const RANGO = { desde: "2026-10-01", hasta: "2026-10-02" };
const HOY = "2026-10-02";

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "roas", nombre: "ROAS", ticketUsd: "1000" }).returning())[0].id;
  otroProgramId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-roas", nombre: "Otro", ticketUsd: "1000" }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  sourceOtro = (await db.insert(sources).values({ programId: otroProgramId, nombre: "Formulario" }).returning())[0].id;
  actor = (await db.insert(users).values({ email: "dev-roas@retia.test", rol: "developer" }).returning())[0].id;
  const cuenta = (await db.insert(cuentasPublicitarias).values({ programId, idMeta: "cuenta-roas", nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota" }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "camp1", nivel: "campana", nombre: "Campaña 1", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "set1", nivel: "conjunto", padreIdMeta: "camp1", nombre: "Conjunto 1", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "ad1", nivel: "anuncio", padreIdMeta: "set1", nombre: "Anuncio 1", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "camp-vacia", nivel: "campana", nombre: "Campaña vacía", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "set-vacio", nivel: "conjunto", padreIdMeta: "camp-vacia", nombre: "Conjunto vacío", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "ad-vacio", nivel: "anuncio", padreIdMeta: "set-vacio", nombre: "Anuncio vacío", estado: "ACTIVE" },
  ]).returning();
  anuncioDbId = objetos.find((o) => o.idMeta === "ad1")!.id;
  await db.insert(tasasCambio).values([
    { vigenteDesde: "2026-10-01", vigenteHasta: "2026-10-01", pesosPorDolar: "4000", fuente: "prueba" },
    { vigenteDesde: "2026-10-02", vigenteHasta: "2026-10-02", pesosPorDolar: "4200", fuente: "prueba" },
  ]);
  await db.insert(gastoPauta).values([
    { programId, fecha: "2026-10-01", monto: "400000", moneda: "COP", origen: "meta_api", pautaObjetoId: anuncioDbId },
    { programId, fecha: "2026-10-02", monto: "210000", moneda: "COP", origen: "meta_api", pautaObjetoId: anuncioDbId },
  ]);
});
afterAll(async () => cerrar());

async function envio(opts: { dia?: string; anuncio?: boolean; programa?: "otro"; parcial?: boolean; token?: string;
  fechaEnvioNull?: boolean; createdAt?: string; campanaId?: boolean; campanaNombre?: boolean } = {}) {
  const programa = opts.programa ? otroProgramId : programId;
  const fuente = opts.programa ? sourceOtro : sourceId;
  const lead = (await db.insert(leads).values({ programId: programa, emailNormalizado: `roas-${++secuencia}@test.co`, nombre: `Lead ${secuencia}` }).returning())[0];
  const fila = (await db.insert(submissions).values({ leadId: lead.id, sourceId: fuente, token: opts.token ?? crypto.randomUUID(),
    esParcial: opts.parcial ?? false,
    fechaEnvio: opts.fechaEnvioNull ? null : new Date(`${opts.dia ?? "2026-10-02"}T10:00:00-05:00`),
    createdAt: new Date(opts.createdAt ?? `${opts.dia ?? "2026-10-02"}T10:00:00-05:00`),
    utmSource: "facebook", utmMedium: "cpc", utmCampaign: opts.campanaNombre ? "Campaña 1" : null,
    utmId: opts.campanaId ? "camp1" : opts.anuncio === false ? null : "ad1" }).returning())[0];
  return { leadId: lead.id, envioId: fila.id, programa };
}

async function vender(e: Awaited<ReturnType<typeof envio>>, valor: string, diaVenta: string, anulada = false) {
  const deal = (await db.insert(deals).values({ programId: e.programa, leadId: e.leadId, submissionOrigenId: e.envioId,
    etapa: "ganado_completo", valorVendidoUsd: valor, anuladoEn: anulada ? new Date(`${diaVenta}T14:00:00-05:00`) : null,
    anuladoPor: anulada ? actor : null, motivoAnulacion: anulada ? "Duplicado" : null }).returning())[0];
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date(`${diaVenta}T12:00:00-05:00`) });
  return deal;
}

async function escenario() {
  const conAnuncio = await envio({ token: "mismo-token" });
  const parcial = (await db.insert(submissions).values({ leadId: conAnuncio.leadId, sourceId, token: "mismo-token", esParcial: true,
    fechaEnvio: null, createdAt: new Date("2026-10-02T09:00:00-05:00"),
    utmSource: "facebook", utmMedium: "cpc", utmId: "ad1" }).returning())[0];
  const venta = await vender({ ...conAnuncio, envioId: parcial.id }, "300", "2026-10-05");
  await db.insert(calls).values([
    { programId, dealId: venta.id, resultado: "show", fechaAgenda: new Date("2026-10-06T10:00:00-05:00"), createdAt: new Date("2026-10-06T09:00:00-05:00") },
    { programId, dealId: venta.id, resultado: "no_show", createdAt: new Date("2026-10-07T10:00:00-05:00") },
  ]);
  await db.insert(abonos).values({ programId, dealId: venta.id, fecha: "2026-10-06", monto: "300", moneda: "USD", concepto: "ticket" });
  const sinAnuncio = await envio({ anuncio: false, dia: "2026-10-01" });
  await vender(sinAnuncio, "100", "2026-10-08");
  await vender(await envio({ dia: "2026-10-01" }), "999", "2026-10-03", true);
  await vender(await envio({ programa: "otro", dia: "2026-10-01" }), "800", "2026-10-03");
}

describe("ROAS de Pauta", () => {
  it("el paid trafficker ve el lead de Pauta pero no gana capacidad administrativa", () => {
    expect(veLeadsDePauta("paid_trafficker")).toBe(true);
    expect(esAdministrador("paid_trafficker")).toBe(false);
  });

  it("ancla ventas al registro, convierte gasto por día y no redistribuye Sin anuncio", async () => {
    await escenario();
    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY);
    const campana = vista.campanas.find((f) => f.id === "camp1")!;
    expect(campana).toMatchObject({ registros: 2, ventas: 1, contratadoUsd: 300, gastoUsd: 150, agendas: 2, shows: 1, noShows: 1 });
    expect(campana.contratadoUsd / campana.gastoUsd).toBe(2);
    expect(vista.total).toMatchObject({ registros: 3, ventas: 2, contratadoUsd: 400, gastoUsd: 150 });
    expect(vista.sinAnuncio).toMatchObject({ ventas: 1, contratadoUsd: 100 });
    expect(vista.campanas.some((fila) => fila.id === "camp-vacia")).toBe(false);
    const html = renderToStaticMarkup(createElement(PautaRoas, {
      vista, enlace: () => "/lista", hrefCsv: "/citas.csv",
    }));
    expect(html).toContain("1 de 2 ventas sin campaña de Meta");
    expect(html).toContain("Cómo se calcula");
    expect(html).not.toContain("Aún madurando");
    expect(html).toContain("Cuándo: ");
    expect(html).toContain("1 en llamada");
    expect(html).toContain("1 sin llamada");
    expect(html).toContain("Pago: ");
    expect(html).toContain("2 completas");
    const permitidas = new Set(["fecha_hora_bogota", "resultado", "campana", "conjunto", "anuncio", "canal"]);
    expect(COLUMNAS_CSV_CITAS_PAUTA.every((columna) => permitidas.has(columna))).toBe(true);
    expect(csvDeCitasPauta(vista).trim().split("\r\n")).toHaveLength(vista.total.agendas + 1);
  });

  it("conserva ventas y citas de parciales, plegando por huella sin inflar registros", async () => {
    const completo = await envio({ token: "plegado" });
    const parcial = (await db.insert(submissions).values({ leadId: completo.leadId, sourceId, token: "plegado", esParcial: true,
      fechaEnvio: null, createdAt: new Date("2026-10-01T09:00:00-05:00"),
      utmSource: "facebook", utmMedium: "cpc", utmId: "ad1" }).returning())[0];
    const plegado = await vender({ ...completo, envioId: parcial.id }, "200", "2026-10-03");
    await db.insert(calls).values({ programId, dealId: plegado.id, resultado: "show" });
    const parcialSolo = await envio({ parcial: true, token: "solo-parcial", fechaEnvioNull: true,
      createdAt: "2026-10-02T08:00:00-05:00" });
    await vender(parcialSolo, "150", "2026-10-04");

    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY);
    expect(vista.total).toMatchObject({ registros: 1, agendas: 1, shows: 1, ventas: 2, contratadoUsd: 350 });
    expect(vista.envios).toHaveLength(2);
    expect(vista.envios.find((fila) => fila.envioId === completo.envioId)?.venta?.dealId).toBe(plegado.id);
    expect(vista.envios.some((fila) => !fila.cuentaComoRegistro && fila.venta?.contratadoUsd === 150)).toBe(true);
  });

  it("atribuye por campaña id o nombre exacto y separa el anuncio sin identificar", async () => {
    await envio({ campanaId: true });
    await envio({ anuncio: false, campanaNombre: true });
    const sinMeta = await envio({ anuncio: false });
    const deal = await vender(sinMeta, "100", "2026-10-03");
    await db.insert(calls).values([
      { programId, dealId: deal.id, resultado: "agendada", fechaAgenda: new Date("2026-10-03T08:00:00-05:00") },
      { programId, dealId: deal.id, resultado: "agendada", fechaAgenda: new Date("2026-10-04T08:00:00-05:00") },
    ]);

    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY, new Date("2026-10-03T12:00:00-05:00"));
    expect(vista.campanas.find((fila) => fila.id === "camp1")).toMatchObject({ registros: 2 });
    expect(vista.anunciosSinIdentificar.find((fila) => fila.padreId === "camp1")).toMatchObject({ registros: 2 });
    expect(vista.cobertura).toEqual({ anuncio: 0, soloCampanaOConjunto: 2, sinCampana: 1 });
    expect(vista.citasSinMarcar).toBe(1);
    const html = renderToStaticMarkup(createElement(PautaRoas, {
      vista, enlace: () => "/lista", hrefCsv: "/citas.csv",
    }));
    // El detalle de la campaña vive en un diálogo cerrado: la fila es un botón y no despliega nada en la tabla.
    expect(html).toContain("<button");
    expect(html).not.toContain("Anuncio sin identificar");
  });

  it("calcula la madurez histórica para el detalle y la lista cuadra por paso", async () => {
    await escenario();
    for (let i = 0; i < 3; i++) await vender(await envio({ dia: `2026-09-0${i + 1}` }), "50", `2026-09-1${i + 1}`);
    const vista = await cargarRoasDePauta(db, programId, RANGO, HOY);
    expect(vista.ventanaCierreDias).not.toBeNull();
    expect(vista.total.desdeDias).toBeLessThan(vista.ventanaCierreDias!);
    const esperado = { registro: vista.total.registros, agenda: vista.total.agendas, show: vista.total.shows,
      no_show: vista.total.noShows, venta: vista.total.ventas } as const;
    for (const paso of Object.keys(esperado) as Array<keyof typeof esperado>) {
      const [lista] = await listaDeMetrica("pauta_meta", { programId, rango: RANGO, hoy: HOY, nivel: "total", paso }, 1, db);
      expect(lista.subtotal.cantidad, paso).toBe(esperado[paso]);
      expect(lista.filas).toHaveLength(esperado[paso]);
      const proyectada = proyectarParaPauta(lista, false);
      expect(proyectada.filas.every((fila) => fila.persona !== null && fila.closer === null && fila.dealId === null && fila.monto === null)).toBe(true);
    }
  });
});
