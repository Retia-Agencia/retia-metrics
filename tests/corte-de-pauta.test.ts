import * as memoria from "@/lib/db/por-solicitud";
import type { PGlite } from "@electric-sql/pglite";
import { opcionesDeCorteDePauta } from "@/lib/pauta/opciones-de-corte";
import { resolverCorteDePauta, ROTULO_DIAGNOSTICO_SIN_CORTE, ROTULO_COSTO_NO_DISPONIBLE } from "@/lib/pauta/corte-de-pauta";
import { resumenDeFiltrosDePauta } from "@/lib/pauta/vista-de-pauta";
import { calcularProyeccionDeRoas } from "@/lib/queries/proyeccion-roas";
import { costoPorAgenda, costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";
import { cifrasDeProyeccion } from "@/lib/pauta/cifras-de-proyeccion";
import { filaDeQueTraeVentas } from "@/lib/pauta/cifras-de-origen";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calls, cohorts, cuentasPublicitarias, dealEtapaHistorial, deals, fotosPauta, gastoPauta, leads, pautaObjetos, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { type CortePauta } from "@/lib/queries/atribucion-de-pauta";
import { cargarRoasDePauta, SIN_CUENTA } from "@/lib/queries/roas-de-pauta";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let cuentaId: string;
const RANGO = { desde: "2026-10-01", hasta: "2026-10-02" };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "atribucion-pauta", nombre: "Pauta", ticketUsd: "1000" }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  cuentaId = (await db.insert(cuentasPublicitarias).values({ programId, idMeta: "cuenta", nombre: "Cuenta", moneda: "USD", zonaHoraria: "America/Bogota" }).returning())[0].id;
  await db.insert(pautaObjetos).values([
    { programId, cuentaId, idMeta: "camp", nivel: "campana", nombre: "Campaña única", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "set", nivel: "conjunto", nombre: "Conjunto", padreIdMeta: "camp", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "ad", nivel: "anuncio", nombre: "Anuncio", padreIdMeta: "set", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "ambigua1", nivel: "campana", nombre: "Repetida", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "ambigua2", nivel: "campana", nombre: "Repetida", estado: "ACTIVE" },
  ]);
});

async function envio(utmId: string | null, utmCampaign: string | null = null, token = crypto.randomUUID(), esParcial = false) {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `${crypto.randomUUID()}@test.co`, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning())[0];
  const fila = (await db.insert(submissions).values({ sourceId, leadId: lead.id, token, esParcial,
    utmSource: "facebook", utmMedium: "cpc", utmId, utmCampaign,
    fechaEnvio: esParcial ? null : new Date("2026-10-02T10:00:00-05:00"),
    createdAt: new Date(esParcial ? "2026-09-30T10:00:00-05:00" : "2026-10-02T10:00:00-05:00"),
  }).returning())[0];
  return { ...fila, nombre: lead.nombre };
}


const AHORA = new Date("2026-10-02T12:00:00-05:00");
async function vista(corte: CortePauta | null = null) {
  return cargarRoasDePauta(db, programId, RANGO, RANGO.hasta, AHORA, null, corte);
}
async function gastoDe(idMeta: string, monto: string) {
  const [objeto] = await db.select().from(pautaObjetos).where(eq(pautaObjetos.idMeta, idMeta));
  await db.insert(gastoPauta).values({ programId, fecha: RANGO.hasta, monto, moneda: "COP", origen: "meta_api", pautaObjetoId: objeto.id, agendasMeta: 2 });
  return objeto;
}
async function dealDelEnvio(e: Awaited<ReturnType<typeof envio>>, vendido = false) {
  const dueno = await duenoDePrueba(db, programId);
  const [cohorte] = await db.insert(cohorts).values({ programId, codigo: crypto.randomUUID(), precioUsd: "100", metaCupos: 5 }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: e.leadId!, submissionOrigenId: e.id,
    cohortId: cohorte.id, ownerUserId: dueno,
    etapa: vendido ? "ganado_completo" : "agendado", valorVendidoUsd: vendido ? "100" : null }).returning();
  if (vendido) await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: AHORA });
  await db.insert(calls).values({ programId, dealId: deal.id, createdAt: AHORA, closerUserId: dueno, resultado: vendido ? "show" : "agendada",
    fechaAgenda: new Date(vendido ? "2026-10-02T11:00:00-05:00" : "2026-10-03T11:00:00-05:00") });
  return deal;
}

describe("Ver solo, fase 2a", () => {
  it("lee únicamente las opciones del programa y valida UUID, nivel y frontera", async () => {
    const otro = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-corte", nombre: "Otro", ticketUsd: "1000" }).returning())[0];
    const cuentaAjena = (await db.insert(cuentasPublicitarias).values({ programId: otro.id, idMeta: "otra-cuenta", nombre: "Ajena", moneda: "USD", zonaHoraria: "America/Bogota" }).returning())[0];
    const objetoAjeno = (await db.insert(pautaObjetos).values({ programId: otro.id, cuentaId: cuentaAjena.id, idMeta: "otra-campana", nombre: "Ajena", nivel: "campana", estado: "ACTIVE" }).returning())[0];
    const opciones = await opcionesDeCorteDePauta(db, programId);
    expect(opciones).toHaveLength(6);
    expect(opciones.some((o) => o.id === SIN_CUENTA)).toBe(false);
    for (const opcion of opciones) {
      expect(resolverCorteDePauta(opciones, opcion.nivel, opcion.id)).toMatchObject({ id: opcion.idMeta, uuid: opcion.id, nivel: opcion.nivel });
      expect(resolverCorteDePauta(opciones, opcion.nivel === "anuncio" ? "campana" : "anuncio", opcion.id)).toBeNull();
    }
    expect(resolverCorteDePauta(opciones, "campana", objetoAjeno.id)).toBeNull();
    expect(resolverCorteDePauta(opciones, "cuenta_meta", cuentaAjena.id)).toBeNull();
    for (const id of ["malformado", "camp", crypto.randomUUID()]) expect(resolverCorteDePauta(opciones, "campana", id)).toBeNull();
    expect(resolverCorteDePauta(opciones, ["campana"], opciones[0].id)).toBeNull();
  });

  it.each(["cuenta_meta", "campana", "conjunto", "anuncio"] as const)("corta %s antes de sumar envíos, citas, ventas y gasto", async (nivel) => {
    const vendido = await envio("ad"); await dealDelEnvio(vendido, true);
    await envio("set"); await envio("camp"); await envio(null);
    const pendiente = await envio("ad", null, "alias");
    const parcial = await envio("camp", null, "alias", true); await dealDelEnvio(parcial);
    await gastoDe("ad", "100"); await gastoDe("ambigua1", "50");
    await db.insert(gastoPauta).values({ programId, fecha: RANGO.hasta, monto: "25", moneda: "COP", origen: "manual", area: "paid" });
    const corte = { nivel, id: nivel === "cuenta_meta" ? cuentaId : nivel === "campana" ? "camp" : nivel === "conjunto" ? "set" : "ad" };
    const v = await vista(corte);
    expect(v.total).toMatchObject({ registros: nivel === "anuncio" ? 2 : nivel === "conjunto" ? 3 : 4,
      agendas: 2, ventas: 1, valorVendidoUsd: 100, gastoCop: nivel === "cuenta_meta" ? 150 : 100 });
    expect(v.agendasPendientes).toBe(1);
    expect(v.envios.find((e) => e.envioId === pendiente.id)?.dealId).toBeTruthy();
    expect(v.cuentas.some((c) => c.id === SIN_CUENTA)).toBe(false);
    expect(v.sinAnuncio.registros).toBe(0);
    expect(v.anunciosSinIdentificar).toEqual([]);
    const lista = await listaDeMetrica("pauta_meta", { programId, rango: RANGO, hoy: RANGO.hasta,
      ahora: AHORA, nivel: "total", paso: "agenda", corte }, 1, db);
    expect(lista[0].subtotal.cantidad).toBe(v.total.agendas);
    const p = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: RANGO.hasta, ahora: AHORA, vista: v, tasasDelPrograma: true });
    expect(p.citasPendientes).toBe(1);
    expect(p.supuestos.citasPendientesIds).toHaveLength(1);
  });

  it.each([
    ["campana", "camp", 60], ["conjunto", "set", 50], ["anuncio", "ad", 30],
  ] as const)("el gasto de %s incluye el objeto y únicamente sus descendientes", async (nivel, id, gasto) => {
    await gastoDe("camp", "10"); await gastoDe("set", "20"); await gastoDe("ad", "30");
    await gastoDe("ambigua1", "50");
    const v = await vista({ nivel, id });
    expect(v.total.gastoCop).toBe(gasto);
    expect(v.campanas.find((c) => c.id === "camp")?.gastoCop).toBe(gasto);
    expect(v.anunciosSinIdentificar).toEqual([]);
  });

  it("sin corte conserva cifras, orden y consultas con los mismos parámetros", async () => {
    await envio("ad"); await envio("camp"); await envio(null);
    await gastoDe("ad", "100");
    await db.insert(gastoPauta).values({ programId, fecha: RANGO.hasta, monto: "25", moneda: "COP", origen: "manual", area: "paid" });
    const cliente = (db as Db & { $client: PGlite }).$client;
    const consultas = vi.spyOn(cliente, "query");
    const cache = vi.spyOn(memoria, "unaVezPorSolicitud");
    const antes = await cargarRoasDePauta(db, programId, RANGO, RANGO.hasta, AHORA);
    const sqlAntes = consultas.mock.calls.map(([sql, params]) => JSON.stringify([sql, params])).sort();
    consultas.mockClear();
    const despues = await vista(null);
    const sqlDespues = consultas.mock.calls.map(([sql, params]) => JSON.stringify([sql, params])).sort();
    consultas.mockRestore();
    expect(cache.mock.calls.map(([, clave]) => clave)).toContain(memoria.claveDe("cargarRoasDePauta", programId,
      RANGO.desde, RANGO.hasta, RANGO.hasta, AHORA, null));
    expect(cache.mock.calls.some(([, clave]) => clave.includes("cargarRoasDePautaConCorte"))).toBe(false);
    cache.mockRestore();
    expect(despues).toEqual(antes);
    expect(sqlDespues).toEqual(sqlAntes);
    expect(despues.total).toMatchObject({ registros: 3, gastoCop: 125 });
    expect(despues.cuentas.map((c) => c.id)).toEqual([cuentaId, SIN_CUENTA]);
    expect(despues.anunciosSinIdentificar[0]).toMatchObject({ registros: 1 });
    expect(despues.sinAnuncio.registros).toBe(1);
    await vista({ nivel: "anuncio", id: "ad" });
    expect(await vista()).toEqual(antes);
  });

  it("sin corte mantiene también las consultas de proyección y costo de hoy", async () => {
    await dealDelEnvio(await envio("ad"));
    await gastoDe("ad", "100");
    const cliente = (db as Db & { $client: PGlite }).$client;
    async function capturar<T>(leer: () => Promise<T>) {
      const espia = vi.spyOn(cliente, "query");
      try {
        const valor = await leer();
        return { valor, sql: espia.mock.calls.map(([sql, params]) => JSON.stringify([sql, params])).sort() };
      } finally { espia.mockRestore(); }
    }
    const a = await capturar(() => costoPorAgenda(db, { programId, dia: RANGO.hasta, hasta: AHORA }));
    const b = await capturar(() => costoPorAgenda(db, { programId, dia: RANGO.hasta, hasta: AHORA, corte: null }));
    expect(b).toEqual(a);
    const v = await vista();
    const p = await capturar(() => calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: RANGO.hasta, ahora: AHORA, vista: v }));
    const q = await capturar(() => calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: RANGO.hasta, ahora: AHORA, vista: v, tasasDelPrograma: false }));
    expect(q).toEqual(p);
  });

  it("el costo de fotos y el cerrado filtran cuenta y campaña, incluido el CRM", async () => {
    const objeto = await gastoDe("ad", "100");
    const campana = (await db.select().from(pautaObjetos).where(eq(pautaObjetos.idMeta, "camp")))[0];
    const otra = (await db.select().from(pautaObjetos).where(eq(pautaObjetos.idMeta, "ambigua1")))[0];
    await gastoDe("ambigua1", "50");
    for (const [c, monto] of [[campana, "100"], [otra, "50"]] as const) await db.insert(fotosPauta).values({ programId,
      campanaId: c.id, tomadaEn: AHORA, fecha: RANGO.hasta, gasto: monto, moneda: "COP", agendasMeta: 2 });
    await dealDelEnvio(await envio("ad")); await dealDelEnvio(await envio("ambigua1"));
    const corte: CortePauta = { nivel: "campana", id: "camp" };
    const foto = await costoPorAgenda(db, { programId, dia: RANGO.hasta, hasta: AHORA, corte });
    expect(foto).toMatchObject({ gasto: 100, agendasMeta: 2, agendasCrm: 1, costo: 50 });
    const cerrado = await costoPorAgendaDeVentana(db, { programId, desde: RANGO.desde, hasta: RANGO.hasta, corte });
    expect(cerrado).toMatchObject({ gasto: 100, agendasMeta: 2, agendasCrm: 1 });
    const cuenta = await costoPorAgenda(db, { programId, dia: RANGO.hasta, hasta: AHORA, corte: { nivel: "cuenta_meta", id: cuentaId } });
    expect(cuenta).toMatchObject({ gasto: 150, agendasMeta: 4, agendasCrm: 2 });
    expect(objeto.nivel).toBe("anuncio");
  });

  it("proyecta solo pendientes del corte usando las tasas del programa, aunque el closer tenga muestra propia", async () => {
    await db.update(programs).set({ muestraMinimaConversion: 1 }).where(eq(programs.id, programId));
    const [cohorte] = await db.insert(cohorts).values({ programId, codigo: "C1", metaCupos: 10, precioUsd: "1000" }).returning();
    const [otroCloser] = await db.insert(users).values({ email: "otro@corte.test", rol: "closer", closerId: "Otro" }).returning();
    for (const vendido of [true, false]) {
      const e = await envio("ad"); const d = await dealDelEnvio(e, vendido);
      await db.update(submissions).set({ fechaEnvio: new Date("2026-09-30T10:00:00-05:00") }).where(eq(submissions.id, e.id));
      await db.update(calls).set({ fechaAgenda: new Date("2026-10-01T10:00:00-05:00"), resultado: vendido ? "show" : "no_show",
        ...(vendido ? {} : { closerUserId: otroCloser.id }) }).where(eq(calls.dealId, d.id));
    }
    const e = await envio("ad"); const pendiente = await dealDelEnvio(e);
    await db.update(deals).set({ cohortId: cohorte.id }).where(eq(deals.id, pendiente.id));
    const ad = (await db.select().from(pautaObjetos).where(eq(pautaObjetos.idMeta, "ad")))[0];
    await db.insert(gastoPauta).values([
      { programId, fecha: RANGO.desde, monto: "0", moneda: "USD", origen: "meta_api", pautaObjetoId: ad.id },
      { programId, fecha: RANGO.hasta, monto: "100", moneda: "USD", origen: "meta_api", pautaObjetoId: ad.id },
    ]);
    const v = await vista({ nivel: "anuncio", id: "ad" });
    const conPrograma = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: RANGO.hasta, ahora: AHORA, vista: v, tasasDelPrograma: true });
    const conCloser = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: RANGO.hasta, ahora: AHORA, vista: v });
    expect(conPrograma.citasPendientes).toBe(1);
    expect(conPrograma.esperadoUsd).toBe(500);
    expect(conPrograma.supuestos.porCloser[0].usaPrograma).toBe(true);
    expect(conCloser.esperadoUsd).toBe(1000);
  });

  it("el resumen y las explicaciones nombran el corte y conservan los rótulos exactos", async () => {
    const opciones = await opcionesDeCorteDePauta(db, programId);
    const corte = resolverCorteDePauta(opciones, "cuenta_meta", cuentaId)!;
    const resumen = resumenDeFiltrosDePauta({ programa: "Pauta", cohorte: null, rango: RANGO, comparacion: null,
      closer: null, escribirFecha: (d) => d, corte });
    expect(resumen).toContain("solo Cuenta · Cuenta");
    expect(ROTULO_COSTO_NO_DISPONIBLE).toBe("No disponible para este corte: el detalle de hoy se guarda por campaña");
    expect(ROTULO_DIAGNOSTICO_SIN_CORTE).toBe("Todo el programa en el periodo: este diagnóstico no sigue «Ver solo».");
    const v = await vista(corte);
    const fila = filaDeQueTraeVentas(v.total, { vista: v, programa: "Pauta", periodo: "octubre", corte }, "total");
    expect(JSON.stringify(fila.roas)).toContain('Cuenta · Cuenta');
    const p = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: RANGO.hasta, ahora: AHORA, vista: v, tasasDelPrograma: true });
    const cifras = cifrasDeProyeccion({ proyeccion: p, historial: [], objetivos: [], hoy: RANGO.hasta, corte });
    expect(JSON.stringify(cifras.proyectado)).toContain("tasas históricas del programa completo");
    expect(JSON.stringify(cifras.aHoy)).toContain("Cuenta · Cuenta");
  });
});
