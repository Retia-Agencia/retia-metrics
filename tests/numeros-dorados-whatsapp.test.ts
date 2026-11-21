import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  calls, cuentasPublicitarias, deals, dealEtapaHistorial, gastoPauta, leads, pautaObjetos, programs, sources,
  submissions, tasasCambio,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cop, num } from "@/lib/format";
import { cargarPautaSemanal, type ClavePautaSemanal, type VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { armarMensajeDeLaHora } from "@/lib/reporte-whatsapp/mensaje";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";
import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";
import { nombreCorto, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/** Mismo sembrado determinista de `numeros-dorados-pauta`: una sola fuente para contrastar texto y tabla. */
const SEMANA = { desde: "2026-10-05", hasta: "2026-10-11" };
const HOY = "2026-10-18";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let anuncioId: string;
let secuencia = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "dorado-whatsapp",
    nombre: "Dorado WhatsApp",
  }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  const cuenta = (await db.insert(cuentasPublicitarias).values({
    programId, idMeta: "dor-cuenta", nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "par-campana", nivel: "campana", nombre: "Campaña", estado: "ACTIVE", proposito: "agenda" },
    { cuentaId: cuenta.id, programId, idMeta: "par-conjunto", nivel: "conjunto", padreIdMeta: "par-campana", nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "par-anuncio", nivel: "anuncio", padreIdMeta: "par-conjunto", nombre: "Anuncio", estado: "ACTIVE" },
  ]).returning();
  anuncioId = objetos.find((objeto) => objeto.nivel === "anuncio")!.id;
  await db.insert(tasasCambio).values({
    vigenteDesde: "2026-09-28", vigenteHasta: HOY, pesosPorDolar: "4000", fuente: "prueba",
  });
  await db.insert(gastoPauta).values([
    {
      programId, fecha: SEMANA.desde, monto: "400000", moneda: "COP", origen: "meta_api",
      pautaObjetoId: anuncioId, agendasMeta: 2, impresiones: 20000, clicsEnlace: 400, vistasLanding: 200,
    },
    ...["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", SEMANA.hasta].map((fecha) => ({
      programId, fecha, monto: "400000", moneda: "COP", origen: "meta_api" as const,
      pautaObjetoId: anuncioId, agendasMeta: 2,
    })),
  ]);

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
    programId,
    fechaPrimeraAplicacion: new Date(`${dia}T10:00:00-05:00`),
    emailNormalizado: `dorado-whatsapp-${++secuencia}@test.co`,
    nombre: `Lead ${secuencia}`,
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
    valorVendidoUsd: venta?.valor ?? null,
  }).returning())[0];
  if (venta) {
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id, a: "ganado_completo", fecha: new Date(`${venta.diaVenta}T12:00:00-05:00`),
    });
  }
  return deal;
}

async function cita(dealId: string, dia: string, resultado: "show" | "no_show") {
  await db.insert(calls).values({
    programId, dealId, resultado,
    fechaAgenda: new Date(`${dia}T11:00:00-05:00`), createdAt: new Date(`${dia}T09:00:00-05:00`),
  });
}

const total = (vista: VistaPautaSemanal, clave: ClavePautaSemanal) =>
  vista.filas.find((fila) => fila.clave === clave)!.celdas.total.valor;

describe("números dorados del mensaje de WhatsApp", () => {
  it("muestra el mismo gasto, agendas y costo por agenda que Pauta", async () => {
    const [datos, pauta] = await Promise.all([
      costoPorAgendaDeVentana(db, { programId, desde: SEMANA.desde, hasta: SEMANA.hasta }),
      cargarPautaSemanal(db, { programId, rango: SEMANA, hoy: HOY, cohorteId: null }),
    ]);
    expect(datos.gasto).toBe(total(pauta, "inversion"));
    expect(datos.agendasMeta).toBe(total(pauta, "agendas_meta"));
    expect(datos.agendasCrm).toBe(total(pauta, "agendas"));
    expect(datos.costo).toBe(total(pauta, "costo_agenda_meta"));

    const metrica: MetricaSemaforo = {
      metrica: "costo_por_agenda", color: "exito", motivo: null, moneda: "COP", dia: SEMANA.hasta,
      ...datos, umbral: null, porcentajeDelUmbral: null, comparacion: null, trayectoria: [], racha: null, notas: [],
    };
    const mensaje = armarMensajeDeLaHora([{
      programa: "Dorado WhatsApp", tipo: "cierre", enlaceHub: "", error: null,
      metricas: [metrica], cuentasMeta: [],
    }], "18:00", null, "https://crm.test");

    expect(mensaje).toContain(`${VOCABULARIO_PAUTA_SEMANAL.inversion} ${cop(total(pauta, "inversion")!)}`);
    expect(mensaje).toContain(`${VOCABULARIO_PAUTA_SEMANAL.agendas_meta} ${num(total(pauta, "agendas_meta")!)}`);
    expect(mensaje).toContain(`${nombreCorto("agendadas")} ${num(total(pauta, "agendas")!)}`);
    expect(mensaje).toContain(`${VOCABULARIO_PAUTA_SEMANAL.costo_agenda_meta}: ${cop(total(pauta, "costo_agenda_meta")!)}`);
  });
});
