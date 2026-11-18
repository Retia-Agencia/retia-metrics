import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Session } from "next-auth";
import {
  abonos, calls, cohorts, cuentasPublicitarias, dealEtapaHistorial, deals, gastoPauta, leads, pautaObjetos, programs, sources,
  submissions, users, usuariosProgramasAlcance,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { areaSql, canalSql, cuentaSql } from "@/lib/atribucion/canal-sql";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { consultarDatosMcp, definicionesDeMetricasMcp } from "@/lib/mcp/herramientas/datos";
import { CATALOGO_DE_VISTAS, VISTAS_DE_LECTURA, type VistaDeLectura } from "@/lib/queries/mcp-lectura/catalogo";
import { consultarDatos, ejecutarAcotado } from "@/lib/queries/mcp-lectura/consultar";
import * as abonoHecho from "@/lib/queries/hechos/abono";
import * as agendaHecho from "@/lib/queries/hechos/agenda";
import * as citaHecho from "@/lib/queries/hechos/cita";
import * as envioHecho from "@/lib/queries/hechos/envio";
import * as gastoHecho from "@/lib/queries/hechos/gasto";
import * as ventaHecho from "@/lib/queries/hechos/venta";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { conexionDeLecturaPglite } from "./helpers/conexion-de-lectura-pglite";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let gerenteId: string;
let paidId: string;
let closerId: string;
const ids: Record<string, string> = {};

const RANGO = { desde: "2000-01-01", hasta: "2100-01-01" };
const PAGINA = { limite: 1000, offset: 0 };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "lectura-a", nombre: "Lectura A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "lectura-b", nombre: "Lectura B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const [gerente, paid, closer] = await db.insert(users).values([
    { email: "gerente-lectura@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "paid-lectura@retia.test", nombre: "Paid", rol: "paid_trafficker" },
    { email: "closer-lectura@retia.test", nombre: "Nicolás", rol: "closer", closerId: "Nicolás" },
  ]).returning();
  gerenteId = gerente.id;
  paidId = paid.id;
  closerId = closer.id;
  await db.insert(usuariosProgramasAlcance).values({ userId: paidId, programId: programaA });
  const [cohorte] = await db.insert(cohorts).values({ programId: programaA, codigo: "L-1", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "activo" }).returning();
  const [fuente, fuenteB] = await db.insert(sources).values([
    { programId: programaA, nombre: "Formulario A" },
    { programId: programaB, nombre: "Formulario B" },
  ]).returning();
  const [cuenta] = await db.insert(cuentasPublicitarias).values({ idMeta: "111", programId: programaA, nombre: "Cuenta 1", moneda: "USD", zonaHoraria: "America/Bogota" }).returning();
  const [campana] = await db.insert(pautaObjetos).values({ cuentaId: cuenta.id, programId: programaA, idMeta: "900", nivel: "campana", nombre: "Campaña", estado: "ACTIVE" }).returning();
  const [anuncio] = await db.insert(pautaObjetos).values({ cuentaId: cuenta.id, programId: programaA, idMeta: "999", nivel: "anuncio", padreIdMeta: campana.idMeta, nombre: "Anuncio", estado: "ACTIVE" }).returning();
  const fecha = (iso: string) => new Date(iso);
  const [l1, l2, l3, l4, l5, lb] = await db.insert(leads).values([
    { programId: programaA, emailNormalizado: "ana@retia.test", nombre: "Ana", fechaPrimeraAplicacion: fecha("2026-11-05T23:30:00-05:00") },
    { programId: programaA, emailNormalizado: "beto@retia.test", nombre: "Beto", fechaPrimeraAplicacion: fecha("2026-11-06T00:30:00-05:00") },
    { programId: programaA, emailNormalizado: "cami@retia.test", nombre: "Cami", fechaPrimeraAplicacion: fecha("2026-11-09T10:00:00-05:00") },
    { programId: programaA, emailNormalizado: "dani@retia.test", nombre: "Dani", fechaPrimeraAplicacion: fecha("2026-11-09T10:00:00-05:00") },
    { programId: programaA, emailNormalizado: "eli@retia.test", nombre: "Eli", fechaPrimeraAplicacion: fecha("2026-11-09T10:00:00-05:00") },
    { programId: programaB, emailNormalizado: "otro@retia.test", nombre: "Ajeno", fechaPrimeraAplicacion: fecha("2026-11-05T10:00:00-05:00") },
  ]).returning();
  const [s1, s2, s3, s4, s5, , sb] = await db.insert(submissions).values([
    // 23:30 de Bogotá del 5 es ya el 6 en UTC: el día de negocio sigue siendo el 5.
    { leadId: l1.id, sourceId: fuente.id, token: "s1", fechaEnvio: fecha("2026-11-05T23:30:00-05:00"), utmSource: "instagram", utmMedium: "paid_social" },
    // La misma persona otra vez: dos envíos, un solo correo.
    { leadId: l1.id, sourceId: fuente.id, token: "s2", fechaEnvio: fecha("2026-11-08T10:00:00-05:00"), utmSource: "instagram", utmMedium: "paid_social" },
    { leadId: l2.id, sourceId: fuente.id, token: "s3", fechaEnvio: fecha("2026-11-06T00:30:00-05:00"), utmSource: "IG  Cuenta Uno", utmMedium: "CPC" },
    // Origen orgánico por su UTM, pero su utm_id está en el árbol de pauta: es paid.
    { leadId: l3.id, sourceId: fuente.id, token: "s4", fechaEnvio: fecha("2026-11-09T10:00:00-05:00"), utmSource: "newsletter", utmMedium: "email", utmId: anuncio.idMeta },
    { leadId: l5.id, sourceId: fuente.id, token: "s5", esParcial: true, fechaEnvio: fecha("2026-11-09T11:00:00-05:00"), utmSource: "instagram", utmMedium: "cpc" },
    // Un parcial de s1 que después se completó (mismo formulario y token): no cuenta aparte.
    { leadId: l1.id, sourceId: fuente.id, token: "s1", esParcial: true, utmSource: "instagram", utmMedium: "paid_social" },
    { leadId: lb.id, sourceId: fuenteB.id, token: "sb", fechaEnvio: fecha("2026-11-05T10:00:00-05:00"), utmSource: "instagram", utmMedium: "cpc" },
  ]).returning();
  const [d1, d2, d3, d4, d5, db1] = await db.insert(deals).values([
    { programId: programaA, leadId: l1.id, submissionOrigenId: s1.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "ganado_parcial", valorVendidoUsd: "797" },
    { programId: programaA, leadId: l2.id, submissionOrigenId: s3.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "ganado_completo", cortesia: true, valorVendidoUsd: "0" },
    { programId: programaA, leadId: l3.id, submissionOrigenId: s4.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "cierre_perdido" },
    { programId: programaA, leadId: l4.id, ownerUserId: closerId, etapa: "ganado_parcial", valorVendidoUsd: "797", anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba" },
    { programId: programaA, leadId: l5.id, etapa: "agendado" },
    { programId: programaB, leadId: lb.id, submissionOrigenId: sb.id, ownerUserId: closerId, etapa: "ganado_parcial", valorVendidoUsd: "1500" },
  ]).returning();
  Object.assign(ids, { d1: d1.id, d2: d2.id, d3: d3.id, d4: d4.id, d5: d5.id, db1: db1.id, s5: s5.id, s1: s1.id, s2: s2.id, s3: s3.id, s4: s4.id, l1: l1.id, anuncio: anuncio.id });
  // d1: vendido el 6, reversado el 7 (se anuló su abono) y vendido otra vez el 8: la venta cuenta el 8.
  await db.insert(dealEtapaHistorial).values([
    { dealId: d1.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
    { dealId: d1.id, de: "ganado_parcial", a: "agendado", userId: closerId, fecha: fecha("2026-11-07T12:00:00-05:00") },
    { dealId: d1.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-08T23:45:00-05:00") },
    { dealId: d2.id, de: "agendado", a: "ganado_completo", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
    { dealId: d4.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
    { dealId: db1.id, de: "agendado", a: "ganado_parcial", userId: closerId, fecha: fecha("2026-11-06T12:00:00-05:00") },
  ]);
  const llamada = (extra: Partial<typeof calls.$inferInsert>) => ({ programId: programaA, origen: "app", resultado: "agendada" as const, ...extra });
  const [c1, c2, c3, c4, c5] = await db.insert(calls).values([
    llamada({ dealId: d1.id, closerUserId: closerId, resultado: "show", fechaAgenda: fecha("2026-11-06T09:00:00-05:00"), fechaLlamada: fecha("2026-11-06T09:00:00-05:00"), createdAt: fecha("2026-11-05T23:50:00-05:00") }),
    llamada({ dealId: d1.id, closerUserId: closerId, anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba", fechaAgenda: fecha("2026-11-06T10:00:00-05:00") }),
    llamada({ dealId: d4.id, closerUserId: closerId, fechaAgenda: fecha("2026-11-07T10:00:00-05:00") }),
    llamada({ dealId: d5.id, fechaAgenda: fecha("2026-11-10T10:00:00-05:00"), createdAt: fecha("2026-11-09T12:00:00-05:00") }),
    llamada({ fechaAgenda: fecha("2026-11-11T10:00:00-05:00"), createdAt: fecha("2026-11-10T12:00:00-05:00") }),
  ]).returning();
  Object.assign(ids, { c1: c1.id, c2: c2.id, c3: c3.id, c4: c4.id, c5: c5.id });
  const [a1, a2, a3, a4] = await db.insert(abonos).values([
    { programId: programaA, dealId: d1.id, fecha: "2026-11-08", monto: "100.50", moneda: "USD", registradoPorUserId: closerId },
    { programId: programaA, dealId: d1.id, fecha: "2026-11-08", monto: "200000", moneda: "COP", registradoPorUserId: closerId },
    { programId: programaA, dealId: d1.id, fecha: "2026-11-08", monto: "50", moneda: "USD", registradoPorUserId: closerId, anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba" },
    { programId: programaA, dealId: d4.id, fecha: "2026-11-08", monto: "30", moneda: "USD", registradoPorUserId: closerId },
    // El primer pago de d1 (2 de nov) es anterior a su entrada a Abonado: la venta se fecha por el pago.
    { programId: programaA, dealId: d1.id, fecha: "2026-11-02", monto: "10", moneda: "USD", registradoPorUserId: closerId },
    // Un pago anulado todavía más viejo no fecha nada.
    { programId: programaA, dealId: d1.id, fecha: "2026-10-01", monto: "5", moneda: "USD", registradoPorUserId: closerId, anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "prueba" },
  ]).returning();
  Object.assign(ids, { a1: a1.id, a2: a2.id, a3: a3.id, a4: a4.id });
  const [g1, g2, g3] = await db.insert(gastoPauta).values([
    { programId: programaA, fecha: "2026-11-05", monto: "300000", moneda: "COP", origen: "manual", area: "paid" },
    { programId: programaA, fecha: "2026-11-05", monto: "999", moneda: "COP", origen: "manual", area: "organico" },
    { programId: programaA, fecha: "2026-11-06", monto: "12.5", moneda: "USD", origen: "manual", pautaObjetoId: anuncio.id },
    { programId: programaB, fecha: "2026-11-05", monto: "7", moneda: "USD", origen: "manual", area: "paid" },
  ]).returning();
  Object.assign(ids, { g1: g1.id, g2: g2.id, g3: g3.id });
});

const conexion = () => conexionDeLecturaPglite(db);

async function leer(consulta: string, opciones: { programas?: string[]; veEquipo?: boolean; limite?: number } = {}) {
  return (await consultarDatos(conexion(), {
    sql: consulta,
    programaIds: opciones.programas ?? [programaA],
    veEquipo: opciones.veEquipo ?? true,
    limite: opciones.limite ?? 1000,
  })).filas;
}

const dia = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : String(valor)).slice(0, 10);

describe("el catálogo coincide con la base", () => {
  it.each(VISTAS_DE_LECTURA)("%s: mismas columnas en el catálogo y en la vista", async (vista) => {
    const filas = (await db.execute(sql`select column_name from information_schema.columns where table_schema = 'mcp_lectura' and table_name = ${vista}`)).rows as Array<{ column_name: string }>;
    expect(filas.map((f) => f.column_name).sort()).toEqual(Object.keys(CATALOGO_DE_VISTAS[vista as VistaDeLectura].columnas).sort());
  });

  it("no hay vistas ni tablas sueltas en el esquema fuera del catálogo y la tabla de alcance", async () => {
    const filas = (await db.execute(sql`select table_name from information_schema.tables where table_schema = 'mcp_lectura'`)).rows as Array<{ table_name: string }>;
    expect(filas.map((f) => f.table_name).sort()).toEqual([...VISTAS_DE_LECTURA, "alcance"].sort());
  });
});

describe("paridad: la vista dice lo mismo que lib/queries", () => {
  const lib = { rango: RANGO, pagina: PAGINA };

  it("envios: sin parciales, día de Bogotá (23:30 sigue siendo el 5) y área por árbol de pauta", async () => {
    const filas = await leer("select id_del_envio, dia, area, canal, cuenta, categoria from mcp_lectura.envios where tipo = 'completo'");
    const esperado = await envioHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(filas.map((f) => f.id_del_envio))).toEqual(new Set(esperado.filas.map((f) => f.envioId)));
    for (const fila of esperado.filas) {
      const vista = filas.find((f) => f.id_del_envio === fila.envioId)!;
      expect({ dia: dia(vista.dia), area: vista.area, canal: vista.canal, cuenta: vista.cuenta, categoria: vista.categoria })
        .toEqual({ dia: dia(fila.dia), area: fila.area, canal: fila.canal, cuenta: fila.cuenta, categoria: fila.categoria });
    }
    const porId = Object.fromEntries(filas.map((f) => [f.id_del_envio, f]));
    expect(dia(porId[ids.s1].dia)).toBe("2026-11-05");
    expect(porId[ids.s4].area).toBe("paid");
    expect(porId[ids.s3].canal).toBe("instagram cuenta uno");
  });

  it("envios: expone `tipo`; un parcial que luego se completó no cuenta aparte y el parcial suelto lleva su día", async () => {
    const filas = await leer("select id_del_envio, tipo, dia from mcp_lectura.envios order by tipo, id_del_envio");
    expect(filas.filter((f) => f.tipo === "parcial").map((f) => f.id_del_envio)).toEqual([ids.s5]);
    expect(filas.filter((f) => f.tipo === "completo")).toHaveLength(4);
    expect(dia(filas.find((f) => f.id_del_envio === ids.s5)!.dia)).toBe("2026-11-09");
  });

  it("envios: dos envíos de un mismo correo cuentan una sola persona", async () => {
    const filas = await leer("select correo, count(*) as envios, count(*) filter (where es_primer_envio_del_correo) as personas from mcp_lectura.envios group by correo order by correo");
    expect(filas.find((f) => f.correo === "ana@retia.test")).toMatchObject({ envios: 2, personas: 1 });
  });

  it("agendas: sin llamada anulada ni de deal anulado, con origen y dueño", async () => {
    const filas = await leer("select id_de_la_llamada, dia, hora_minuto, area, canal, cuenta, dueno, cohorte_id, etapa, tiene_envio from mcp_lectura.agendas");
    const esperado = await agendaHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(filas.map((f) => f.id_de_la_llamada))).toEqual(new Set(esperado.filas.map((f) => f.callId)));
    expect(filas.map((f) => f.id_de_la_llamada)).not.toContain(ids.c2);
    expect(filas.map((f) => f.id_de_la_llamada)).not.toContain(ids.c3);
    for (const fila of esperado.filas) {
      const vista = filas.find((f) => f.id_de_la_llamada === fila.callId)!;
      expect({ dia: dia(vista.dia), hm: vista.hora_minuto, area: vista.area, canal: vista.canal, cuenta: vista.cuenta, dueno: vista.dueno, cohorte: vista.cohorte_id, etapa: vista.etapa })
        .toEqual({ dia: dia(fila.dia), hm: fila.horaMinuto, area: fila.area, canal: fila.canal, cuenta: fila.cuenta, dueno: fila.dueno, cohorte: fila.cohorte, etapa: fila.etapa });
    }
    const c1 = filas.find((f) => f.id_de_la_llamada === ids.c1)!;
    expect(dia(c1.dia)).toBe("2026-11-05");
    expect(filas.find((f) => f.id_de_la_llamada === ids.c4)).toMatchObject({ area: "sin_envio_origen", tiene_envio: "si".replace("si", "no") });
  });

  it("agendas y citas llevan su universo: Paid o todas las áreas", async () => {
    for (const vista of ["agendas", "citas"]) {
      const filas = await leer(`select id_de_la_llamada, universo_paid, area from mcp_lectura.${vista}`);
      for (const fila of filas) expect(fila.universo_paid).toBe(fila.area === "paid" ? "si" : "no");
      expect(filas.find((f) => f.id_de_la_llamada === ids.c1)).toMatchObject({ universo_paid: "si" });
      expect(filas.find((f) => f.id_de_la_llamada === ids.c4)).toMatchObject({ universo_paid: "no" });
    }
  });

  it("citas: día de la cita y `ocurrio`", async () => {
    const filas = await leer("select id_de_la_llamada, dia, area, ocurrio, etapa from mcp_lectura.citas");
    const esperado = await citaHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(filas.map((f) => f.id_de_la_llamada))).toEqual(new Set(esperado.filas.map((f) => f.callId)));
    for (const fila of esperado.filas) {
      const vista = filas.find((f) => f.id_de_la_llamada === fila.callId)!;
      expect({ dia: dia(vista.dia), area: vista.area, ocurrio: vista.ocurrio, etapa: vista.etapa })
        .toEqual({ dia: dia(fila.dia), area: fila.area, ocurrio: fila.ocurrio, etapa: fila.etapa });
    }
  });

  it("ventas: Abonado o Completo, sin cortesía, sin anulado; día de venta = primer pago vigente y día de etapa tras la reversa", async () => {
    const filas = await leer("select id_del_deal, dia, area, canal, cuenta, dueno, cohorte_id from mcp_lectura.ventas");
    const esperado = await ventaHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(filas.map((f) => f.id_del_deal))).toEqual(new Set(esperado.filas.map((f) => f.dealId)));
    expect(filas.map((f) => f.id_del_deal)).toEqual([ids.d1]);
    // Hoy el módulo de lib todavía fecha por la etapa: se compara contra `dia_de_etapa`; la definición nueva (primer pago) se afirma aparte.
    const [fecha] = await leer("select dia, dia_de_venta, dia_de_etapa from mcp_lectura.ventas");
    expect(dia(fecha.dia_de_etapa)).toBe("2026-11-08");
    expect(dia(fecha.dia_de_etapa)).toBe(dia(esperado.filas[0].dia));
    expect(dia(fecha.dia_de_venta)).toBe("2026-11-02");
    expect(dia(fecha.dia)).toBe(dia(fecha.dia_de_venta));
    expect({ area: filas[0].area, canal: filas[0].canal, dueno: filas[0].dueno }).toEqual({ area: esperado.filas[0].area, canal: esperado.filas[0].canal, dueno: esperado.filas[0].dueno });
  });

  it("abonos: sin anulados, moneda aparte y el abono de un deal anulado se ve marcado", async () => {
    const filas = await leer("select id_del_abono, dia, moneda, monto, dueno, cohorte_id, deal_vigente from mcp_lectura.abonos");
    const esperado = await abonoHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(filas.map((f) => f.id_del_abono))).toEqual(new Set(esperado.filas.map((f) => f.abonoId)));
    expect(filas.map((f) => f.id_del_abono)).not.toContain(ids.a3);
    for (const fila of esperado.filas) {
      const vista = filas.find((f) => f.id_del_abono === fila.abonoId)!;
      expect({ dia: dia(vista.dia), moneda: vista.moneda, monto: Number(vista.monto), dueno: vista.dueno })
        .toEqual({ dia: dia(fila.dia), moneda: fila.moneda, monto: Number(fila.monto), dueno: fila.dueno });
    }
    expect(filas.find((f) => f.id_del_abono === ids.a4)).toMatchObject({ deal_vigente: false });
  });

  it("gasto: solo Paid o colgado de un objeto, en su moneda y con su cuenta", async () => {
    const filas = await leer("select id_del_gasto, dia, moneda, monto, objeto_de_pauta, cuenta_meta from mcp_lectura.gasto");
    const esperado = await gastoHecho.listar(db, { programId: programaA, ...lib });
    expect(new Set(filas.map((f) => f.id_del_gasto))).toEqual(new Set(esperado.filas.map((f) => f.gastoId)));
    expect(filas.map((f) => f.id_del_gasto)).not.toContain(ids.g2);
    for (const fila of esperado.filas) {
      const vista = filas.find((f) => f.id_del_gasto === fila.gastoId)!;
      expect({ dia: dia(vista.dia), moneda: vista.moneda, monto: Number(vista.monto), objeto: vista.objeto_de_pauta, cuenta: vista.cuenta_meta })
        .toEqual({ dia: dia(fila.dia), moneda: fila.moneda, monto: Number(fila.monto), objeto: fila.objeto_de_pauta, cuenta: fila.cuenta_meta });
    }
  });

  it("leads y deals: únicos por correo, y el deal anulado no aparece", async () => {
    const personas = await leer("select correo, cuenta_como_lead, dia_primera_aplicacion from mcp_lectura.leads order by correo");
    expect(personas.map((p) => p.correo)).toEqual(["ana@retia.test", "beto@retia.test", "cami@retia.test", "dani@retia.test", "eli@retia.test"]);
    expect(dia(personas[0].dia_primera_aplicacion)).toBe("2026-11-05");
    const tratos = await leer("select id_del_deal from mcp_lectura.deals");
    expect(tratos.map((t) => t.id_del_deal)).not.toContain(ids.d4);
    expect(tratos).toHaveLength(4);
  });

  it("las gemelas SQL de canal y área dan lo mismo que lib/atribucion/canal-sql", async () => {
    const fuentes = [null, "", "  ", "IG Cuenta Uno", "fb", "ig   x  y", "{{campaign}}", "Instagram", "an Foo", "msg", "th mi cuenta", "google", " TikTok  Ads "];
    const medios = [null, "cpc", "paid_social", "Paid", "referido", "email", "{{x}}", ""];
    for (const s of fuentes) for (const m of medios) {
      const fuente = sql`${s}::text`;
      const medio = sql`${m}::text`;
      const [esperado] = (await db.execute(sql`select ${canalSql({ source: fuente, medium: medio })} as canal, ${cuentaSql({ source: fuente, medium: medio })} as cuenta, ${areaSql({ source: fuente, medium: medio })} as area`)).rows as Array<Record<string, string | null>>;
      const [vista] = (await db.execute(sql`select mcp_lectura.utm_canal(${s}::text) as canal, mcp_lectura.utm_cuenta(${s}::text) as cuenta, mcp_lectura.utm_area(${s}::text, ${m}::text, ${programaA}::uuid, null, null) as area`)).rows as Array<Record<string, string | null>>;
      expect(vista, `fuente=${s} medio=${m}`).toEqual(esperado);
    }
  });
});

describe("alcance", () => {
  it("un programa ajeno es invisible aunque el agente lo pida por nombre", async () => {
    const filas = await leer("select programa, count(*) as n from mcp_lectura.envios group by programa");
    expect(filas).toEqual([{ programa: "lectura-a", n: 5 }]);
    expect(await leer("select * from mcp_lectura.deals where programa = 'lectura-b'")).toEqual([]);
    expect(await leer("select * from mcp_lectura.gasto where programa = 'lectura-b'")).toEqual([]);
  });

  it("dos programas visibles se ven juntos, cada fila con su programa", async () => {
    const filas = await leer("select programa, count(*) as n from mcp_lectura.deals group by programa order by programa", { programas: [programaA, programaB] });
    expect(filas.map((f) => f.programa)).toEqual(["lectura-a", "lectura-b"]);
  });

  it("sin programas visibles no se ve nada", async () => {
    expect(await leer("select * from mcp_lectura.leads", { programas: [] })).toEqual([]);
  });

  it("quien no ve al equipo comercial recibe dueño y registrador nulos, y el resto igual", async () => {
    const [ventas] = await leer("select dueno, dueno_nombre, valor_vendido_usd from mcp_lectura.ventas", { veEquipo: false });
    expect(ventas).toEqual({ dueno: null, dueno_nombre: null, valor_vendido_usd: 797 });
    const abonosPauta = await leer("select registrado_por, registrado_por_nombre, dueno from mcp_lectura.abonos", { veEquipo: false });
    expect(abonosPauta.every((a) => a.registrado_por === null && a.registrado_por_nombre === null && a.dueno === null)).toBe(true);
    const [conEquipo] = await leer("select dueno_nombre from mcp_lectura.ventas", { veEquipo: true });
    expect(conEquipo.dueno_nombre).toBe("Nicolás");
  });

  it("un predicado del agente no se evalúa antes del alcance (security_barrier)", async () => {
    // Si la división se evaluara sobre las filas del otro programa antes de cruzar el alcance, fallaría con división por cero.
    const filas = await leer("select count(*) as n from mcp_lectura.gasto where 1 / (case when programa = 'lectura-b' then 0 else 1 end) = 1");
    expect(filas).toEqual([{ n: 2 }]);
  });
});

describe("la base rechaza lo que la validación previa no vio", () => {
  const acotado = (texto: string, limite = 10) => ejecutarAcotado(conexion(), { sql: texto, programaIds: [programaA], veEquipo: true, limite });

  it("sin acceso a las tablas de la app ni a la de alcance", async () => {
    await expect(acotado("select * from public.deals")).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select * from mcp_lectura.alcance")).rejects.toMatchObject({ code: "42501" });
    await expect(acotado("select * from public.users")).rejects.toMatchObject({ code: "42501" });
  });

  it("escrituras, DDL y ajustes de solo lectura fallan", async () => {
    await expect(acotado("with x as (insert into mcp_lectura.alcance values (1, gen_random_uuid(), true) returning 1) select * from x")).rejects.toBeTruthy();
    await expect(acotado("with x as (update public.deals set etapa = 'registrado' returning 1) select * from x")).rejects.toBeTruthy();
    await expect(acotado("select set_config('transaction_read_only', 'off', true)")).rejects.toMatchObject({ code: expect.stringMatching(/^2500[16]$/) });
  });

  it("el alcance no se puede fijar dos veces ni forjar desde el SQL del agente", async () => {
    await expect(acotado(`select mcp_lectura.fijar_alcance(array['${programaB}']::uuid[], true)`)).rejects.toMatchObject({ code: "42501" });
    const pedido = acotado(`select count(*) from mcp_lectura.deals where programa = 'lectura-b'`);
    expect((await pedido).filas).toEqual([[0]]);
  });

  it("el tope de filas trae una de más para saber que hay más", async () => {
    const r = await acotado("select generate_series(1, 5000)", 10);
    expect(r.filas).toHaveLength(11);
  });
});

describe("consultar_datos (herramienta)", () => {
  const sesion = (userId: string, rol: ContextoMcp["rol"]) => ({ user: { id: userId, email: `${rol}@retia.test`, name: rol, rol, operaComoCloser: false, closerId: null, alcanceLimitado: false } } as Session);
  const contexto = (userId: string, rol: ContextoMcp["rol"], conLectura = true): ContextoMcp => ({
    db, session: sesion(userId, rol), rol, tokenId: crypto.randomUUID(), escritura: false, conexionDeLectura: conLectura ? conexion() : null,
  });

  it("solo gerente, paid trafficker y developer la ven, y solo con conexión de lectura", () => {
    expect(consultarDatosMcp.puede(contexto(gerenteId, "gerente"))).toBe(true);
    expect(consultarDatosMcp.puede(contexto(paidId, "paid_trafficker"))).toBe(true);
    expect(consultarDatosMcp.puede(contexto(gerenteId, "developer"))).toBe(true);
    expect(consultarDatosMcp.puede(contexto(closerId, "closer"))).toBe(false);
    expect(consultarDatosMcp.puede(contexto(closerId, "customer_success"))).toBe(false);
    expect(consultarDatosMcp.puede(contexto(gerenteId, "gerente", false))).toBe(false);
    expect(definicionesDeMetricasMcp.puede(contexto(gerenteId, "gerente", false))).toBe(true);
    expect(definicionesDeMetricasMcp.puede(contexto(closerId, "closer"))).toBe(false);
  });

  it("devuelve filas, columnas, la fórmula en palabras y dice que no es una cifra del Hub", async () => {
    const pedido = consultarDatosMcp.entrada.parse({ sql: "select programa, count(*) as ventas from mcp_lectura.ventas group by programa", programa: "lectura-a" });
    const { estructurado, texto } = await consultarDatosMcp.ejecutar(contexto(gerenteId, "gerente"), pedido);
    expect(estructurado.filas).toEqual([{ programa: "lectura-a", ventas: 1 }]);
    expect(estructurado.columnas).toEqual([{ nombre: "programa", tipo: "texto" }, { nombre: "ventas", tipo: "numero" }]);
    expect(estructurado.es_cifra_del_hub).toBe(false);
    expect(estructurado.como_se_calculo).toContain("Abonado o Completo");
    expect((estructurado.metricas_del_hub_relacionadas as Array<{ clave: string }>).map((m) => m.clave)).toContain("ventas");
    expect(texto).toContain("No es una cifra del Hub");
    expect(consultarDatosMcp.salida.safeParse(estructurado).success).toBe(true);
  });

  it("un paid trafficker solo ve su programa y no ve al equipo comercial", async () => {
    const todos = await consultarDatosMcp.ejecutar(contexto(paidId, "paid_trafficker"), consultarDatosMcp.entrada.parse({ sql: "select programa, dueno from mcp_lectura.deals" }));
    expect(new Set((todos.estructurado.filas as Array<{ programa: string }>).map((f) => f.programa))).toEqual(new Set(["lectura-a"]));
    expect((todos.estructurado.filas as Array<{ dueno: string | null }>).every((f) => f.dueno === null)).toBe(true);
    await expect(consultarDatosMcp.ejecutar(contexto(paidId, "paid_trafficker"), consultarDatosMcp.entrada.parse({ sql: "select 1", programa: "lectura-b" }))).rejects.toThrow("No existe ese programa");
  });

  it("el tope de filas marca truncado", async () => {
    const r = await consultarDatosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarDatosMcp.entrada.parse({ sql: "select id_del_envio from mcp_lectura.envios", limite: 2 }));
    expect(r.estructurado).toMatchObject({ truncado: true, limite: 2 });
    expect(r.estructurado.filas).toHaveLength(2);
  });

  it.each([
    ["INSERT", "insert into mcp_lectura.deals select 1", /INSERT/],
    ["UPDATE", "update public.deals set etapa = 'x'", /UPDATE/],
    ["set_config", "select set_config('role', 'postgres', true)", /set_config/],
    ["DDL", "create table z (a int)", /CREATE/],
    ["varias sentencias", "select 1; select 2", /una consulta por llamada/],
    ["fijar_alcance", "select mcp_lectura.fijar_alcance(array[]::uuid[], true)", /fijar_alcance/],
    ["tablas de la app", "select * from public.deals", /public/],
    ["query_to_xml", "select query_to_xml('select 1', true, false, '')", /query_to_xml/],
  ])("rechaza %s con un mensaje útil", async (_nombre, consulta, mensaje) => {
    await expect(consultarDatosMcp.ejecutar(contexto(gerenteId, "gerente"), consultarDatosMcp.entrada.parse({ sql: consulta }))).rejects.toThrow(mensaje);
  });

  it("un comentario al final no rompe el tope de filas ni deja pasar una segunda sentencia", async () => {
    const ok = await leer("select 1 as a -- comentario final");
    expect(ok).toEqual([{ a: 1 }]);
    await expect(leer("select 1 /* ; */ ; select 2")).rejects.toThrow(/una consulta por llamada/);
    expect(await leer("select ';' as texto")).toEqual([{ texto: ";" }]);
  });
});

describe("definiciones_de_metricas", () => {
  const contexto = (): ContextoMcp => ({ db, session: { user: { id: gerenteId, rol: "gerente" } } as Session, rol: "gerente", tokenId: "t", escritura: false, conexionDeLectura: conexion() });

  it("describe cada vista con todas sus columnas y las métricas del Hub que salen de ella", async () => {
    const { estructurado } = await definicionesDeMetricasMcp.ejecutar(contexto(), definicionesDeMetricasMcp.entrada.parse({}));
    expect(definicionesDeMetricasMcp.salida.safeParse(estructurado).success).toBe(true);
    const vistas = estructurado.vistas as Array<{ nombre: string; columnas: unknown[]; metricas_del_hub: Array<{ clave: string; consultar_con: string }> }>;
    expect(vistas.map((v) => v.nombre)).toEqual([...VISTAS_DE_LECTURA]);
    const ventas = vistas.find((v) => v.nombre === "ventas")!;
    expect(ventas.columnas).toHaveLength(Object.keys(CATALOGO_DE_VISTAS.ventas.columnas).length);
    expect(ventas.metricas_del_hub.map((m) => m.clave)).toContain("ventas");
    expect(ventas.metricas_del_hub.every((m) => m.consultar_con === "consultar_metrica")).toBe(true);
    expect(estructurado.consultar_datos_disponible).toBe(true);
  });

  it("filtra por vista y dice si consultar_datos no está habilitada", async () => {
    const sinLectura = { ...contexto(), conexionDeLectura: null };
    const r = await definicionesDeMetricasMcp.ejecutar(sinLectura, definicionesDeMetricasMcp.entrada.parse({ vista: "abonos" }));
    expect((r.estructurado.vistas as unknown[]).length).toBe(1);
    expect(r.estructurado.consultar_datos_disponible).toBe(false);
    expect(r.texto).toContain("no está habilitada");
  });
});
