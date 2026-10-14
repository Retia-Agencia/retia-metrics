import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abonos,
  calls,
  dealEtapaHistorial,
  deals,
  leads,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import * as agenda from "@/lib/queries/hechos/agenda";
import * as abono from "@/lib/queries/hechos/abono";
import * as cita from "@/lib/queries/hechos/cita";
import * as envio from "@/lib/queries/hechos/envio";
import * as venta from "@/lib/queries/hechos/venta";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let ownerId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "hechos", nombre: "Hechos", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "hechos-otro", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  [programId, otroProgramId] = programas.map((programa) => programa.id);
  ownerId = await db.insert(users).values({ email: "hechos@retia.test", rol: "closer" })
    .returning().then(([usuario]) => usuario.id);

  const fuentes = await db.insert(sources).values([
    { programId, nombre: "Formulario A" },
    { programId: otroProgramId, nombre: "Formulario B" },
  ]).returning();

  const crearOrigen = async (
    programa: string,
    fuente: string,
    indice: number,
    utm: [string | null, string | null, string | null],
  ) => {
    const lead = await db.insert(leads).values({
      programId: programa,
      emailNormalizado: `hecho-${programa}-${indice}@test.co`,
    }).returning().then(([fila]) => fila);
    const [source, medium, campaign] = utm;
    const submission = await db.insert(submissions).values({
      leadId: lead.id,
      sourceId: fuente,
      token: `token-${programa}-${indice}`,
      fechaEnvio: new Date(`2026-09-${10 + indice}T10:00:00-05:00`),
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
    }).returning().then(([fila]) => fila);
    return { lead, submission };
  };

  const uno = await crearOrigen(programId, fuentes[0].id, 1, ["facebook rosario", "cpc", "campana-a"]);
  const dos = await crearOrigen(programId, fuentes[0].id, 2, [null, null, null]);
  await crearOrigen(otroProgramId, fuentes[1].id, 3, ["facebook", "cpc", "ajena"]);
  await db.insert(submissions).values({
    leadId: uno.lead.id,
    sourceId: fuentes[0].id,
    token: "parcial",
    esParcial: true,
    fechaEnvio: new Date("2026-09-13T10:00:00-05:00"),
  });

  const filasDeal = await db.insert(deals).values([
    {
      leadId: uno.lead.id,
      programId,
      submissionOrigenId: uno.submission.id,
      ownerUserId: ownerId,
      etapa: "ganado_parcial",
    },
    {
      leadId: dos.lead.id,
      programId,
      submissionOrigenId: dos.submission.id,
      ownerUserId: ownerId,
      etapa: "ganado_parcial",
    },
  ]).returning();
  const ajeno = await db.select().from(leads).where((await import("drizzle-orm")).eq(leads.programId, otroProgramId)).then((filas) => filas[0]);
  const envioAjeno = await db.select().from(submissions).where((await import("drizzle-orm")).eq(submissions.leadId, ajeno.id)).then((filas) => filas[0]);
  const dealAjeno = await db.insert(deals).values({
    leadId: ajeno.id,
    programId: otroProgramId,
    submissionOrigenId: envioAjeno.id,
    etapa: "ganado_parcial",
  }).returning().then(([fila]) => fila);

  await db.insert(dealEtapaHistorial).values([
    { dealId: filasDeal[0].id, de: "compromiso_verbal", a: "ganado_parcial", fecha: new Date("2026-09-15T10:00:00-05:00") },
    { dealId: filasDeal[1].id, de: "compromiso_verbal", a: "ganado_parcial", fecha: new Date("2026-09-16T10:00:00-05:00") },
    { dealId: dealAjeno.id, de: "compromiso_verbal", a: "ganado_parcial", fecha: new Date("2026-09-15T10:00:00-05:00") },
  ]);

  await db.insert(calls).values([
    { dealId: filasDeal[0].id, programId, fechaAgenda: new Date("2026-09-17T10:00:00-05:00"), resultado: "show", createdAt: new Date("2026-09-10T10:00:00-05:00") },
    { dealId: filasDeal[1].id, programId, fechaAgenda: new Date("2026-09-18T10:00:00-05:00"), resultado: "agendada", createdAt: new Date("2026-09-11T10:00:00-05:00") },
    { dealId: filasDeal[0].id, programId, fechaAgenda: new Date("2026-09-19T10:00:00-05:00"), resultado: "show", createdAt: new Date("2026-09-12T10:00:00-05:00"), anuladoEn: new Date(), anuladoPor: ownerId, motivoAnulacion: "error" },
    { dealId: dealAjeno.id, programId: otroProgramId, fechaAgenda: new Date("2026-09-17T10:00:00-05:00"), resultado: "show", createdAt: new Date("2026-09-10T10:00:00-05:00") },
  ]);

  await db.insert(abonos).values([
    { dealId: filasDeal[0].id, programId, fecha: "2026-09-20", monto: "100", moneda: "USD" },
    { dealId: filasDeal[1].id, programId, fecha: "2026-09-21", monto: "200", moneda: "USD" },
    { dealId: filasDeal[0].id, programId, fecha: "2026-09-22", monto: "999", moneda: "USD", anuladoEn: new Date(), anuladoPor: ownerId, motivoAnulacion: "error" },
    { dealId: dealAjeno.id, programId: otroProgramId, fecha: "2026-09-20", monto: "999", moneda: "USD" },
  ]);
}, 60_000);

afterEach(async () => cerrar());

describe("capa de hechos", () => {
  it("envio: agrupar y listar comparten universo, filtros, orden y pagina", async () => {
    const grupos = await envio.agrupar(db, {
      programId,
      rango: RANGO,
      agruparPor: ["dia", "area", "canal"],
      orden: { campo: "dia", sentido: "desc" },
    });
    const p1 = await envio.listar(db, { programId, rango: RANGO, pagina: { numero: 1, tamano: 1 }, orden: { campo: "dia", sentido: "asc" } });
    const p2 = await envio.listar(db, { programId, rango: RANGO, pagina: { numero: 2, tamano: 1 }, orden: { campo: "dia", sentido: "asc" } });
    expect(grupos.reduce((n, fila) => n + fila.envios, 0)).toBe(p1.total);
    expect([...p1.filas, ...p2.filas]).toHaveLength(2);
    expect(p1.filas[0].dia < p2.filas[0].dia).toBe(true);
    const pagados = await envio.listar(db, { programId, rango: RANGO, filtros: { area: ["paid"] }, pagina: { limite: 10, offset: 0 } });
    expect(pagados.total).toBe(1);
    const sinCampana = await envio.listar(db, { programId, rango: RANGO, filtros: { campana: [null] }, pagina: { limite: 10, offset: 0 } });
    expect(sinCampana.total).toBe(1);
  });

  it("agenda y cita cuadran con sus listas y excluyen anuladas y otros programas", async () => {
    const agendas = await agenda.agrupar(db, { programId, rango: RANGO, agruparPor: ["dia", "area", "dueno"] });
    const listaAgendas = await agenda.listar(db, { programId, rango: RANGO, pagina: { limite: 10, offset: 0 } });
    expect(agendas.reduce((n, fila) => n + fila.agendas, 0)).toBe(listaAgendas.total);
    expect(listaAgendas.total).toBe(2);

    const citas = await cita.agrupar(db, { programId, rango: RANGO, agruparPor: ["dia", "ocurrio", "canal"] });
    const listaCitas = await cita.listar(db, { programId, rango: RANGO, pagina: { numero: 1, tamano: 10 } });
    expect(citas.reduce((n, fila) => n + fila.citas, 0)).toBe(listaCitas.total);
    expect(citas.reduce((n, fila) => n + fila.shows, 0)).toBe(1);
  });

  it("venta y abono agregan lo mismo que sus filas subyacentes", async () => {
    const ventas = await venta.agrupar(db, { programId, rango: RANGO, agruparPor: ["dia", "area", "dueno"] });
    const listaVentas = await venta.listar(db, { programId, rango: RANGO, pagina: { limite: 10, offset: 0 } });
    expect(ventas.reduce((n, fila) => n + fila.ventas, 0)).toBe(listaVentas.total);
    expect(listaVentas.total).toBe(2);

    const abonosAgrupados = await abono.agrupar(db, { programId, rango: RANGO, agruparPor: ["mes", "moneda", "dueno"] });
    const listaAbonos = await abono.listar(db, { programId, rango: RANGO, pagina: { limite: 1, offset: 0 }, orden: { campo: "dia", sentido: "asc" } });
    expect(abonosAgrupados.reduce((n, fila) => n + fila.abonos, 0)).toBe(listaAbonos.total);
    expect(abonosAgrupados.reduce((n, fila) => n + fila.monto, 0)).toBe(300);
    expect(listaAbonos.total).toBe(2);
  });

  it("rechaza dimensiones desconocidas y alcances sin programa en tipos", () => {
    if (false) {
      // @ts-expect-error Una dimension fuera de la lista blanca no compila.
      void envio.agrupar(db, { programId, rango: RANGO, agruparPor: ["inventada"] });
      // @ts-expect-error Una llave de filtro fuera de la lista blanca no compila.
      void envio.listar(db, { programId, rango: RANGO, filtros: { inventada: ["x"] }, pagina: { limite: 1, offset: 0 } });
      // @ts-expect-error El programa es frontera obligatoria, no un filtro opcional.
      void venta.listar(db, { rango: RANGO, pagina: { limite: 1, offset: 0 } });
    }
    expect(true).toBe(true);
  });
});
