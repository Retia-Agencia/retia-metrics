import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  abonos,
  areas,
  calls,
  changeLog,
  cohorts,
  dealEtapaHistorial,
  deals,
  miembrosPrograma,
  programs,
  sources,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import { desmarcarOnboarded, marcarOnboarded } from "@/lib/deals/estudiante";
import { pegarGrain } from "@/lib/deals/llamadas";
import { editarAcuerdoDePago } from "@/lib/deals/pago";
import { carteraVencida } from "@/lib/queries/cartera";
import { estudiantesDe } from "@/lib/queries/estudiantes";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA, sembrarEstadosDeLlegada } from "./helpers/programa-de-prueba";
import real from "./fixtures/typeform-real-tactical.json";

/**
 * Prueba de COSTURA de la etapa E2 (`docs/plan-reparto.md`, E2): "una cita de Calendly cae en
 * su deal, el Grain lo pasa a Atendido, un abono a Abonado, el que salda a Completo, y anular
 * ese abono lo devuelve". Cruza los dos carriles en un solo recorrido, contra PGlite con TODAS
 * las migraciones:
 *
 *  - carril Alejo (Calendly): un envío firmado con agenda vigente entra por la RUTA real del
 *    webhook y deja el deal en Agendado con su llamada (`calendly:<uuid>`);
 *  - carril Mani (dinero): el Grain, los abonos, la anulación, el acuerdo de pago, la cartera
 *    vencida y los estudiantes (`lib/deals/*`, `lib/queries/*`).
 *
 * Lo que la costura protege es lo que ningún test de un solo carril ve: que la llamada que
 * trajo Calendly sea la que el Grain marca, que el deal que abrió el envío sea el que recibe el
 * dinero, y que cada cifra (saldo, cartera, estudiantes) diga lo mismo en cada paso.
 * Molde: `tests/costura-e1.test.ts` y `tests/webhook-matriz.test.ts`.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

vi.mock("@/lib/ingesta/regla-de-deals", async (importOriginal) => {
  try {
    return await importOriginal<Record<string, unknown>>();
  } catch {
    return {};
  }
});

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let areaId: string;
let webhookSourceId: string;
let closer: string;
let gerente: string;

const SECRETO = "secreto-de-prueba-hmac-32-bytes-aqui";
const AGENDA = "Agenda aquí tu entrevista";
const comoCloser = () => ({ userId: closer, rol: "closer" as const });
const HOY = "2026-10-20";

function firmar(cuerpo: string): string {
  return "sha256=" + createHmac("sha256", SECRETO).update(cuerpo, "utf8").digest("base64");
}

async function enviar(payload: unknown): Promise<Response> {
  const cuerpo = JSON.stringify(payload);
  const { POST } = await import("@/app/api/webhooks/formularios/[fuente]/route");
  return POST(
    new Request("https://app.retia.co/api/webhooks/formularios/x", {
      method: "POST",
      headers: { "content-type": "application/json", "Typeform-Signature": firmar(cuerpo) },
      body: cuerpo,
    }),
    { params: Promise.resolve({ fuente: webhookSourceId }) },
  );
}

type Fixture = {
  form_response: {
    variables?: { key: string; type: string; text?: string }[];
    answers: { field: { id: string }; [k: string]: unknown }[];
  };
};

/** El envío real de Tactical, con Estado `con_calendly` y un link de agenda con el uuid del invitado. */
function envioConCita(uuid: string): Fixture {
  const p = structuredClone(real) as unknown as Fixture;
  p.form_response.variables = [{ key: "estado", type: "text", text: "setteo_no_calificado" }];
  p.form_response.answers.find((a) => a.field.id === "f-agenda")!.url = `https://calendly.com/d/x/y/invitees/${uuid}`;
  return p;
}

/** Calendly: la cita del invitado existe, está activa y empieza en `inicio`. */
function stubCalendly(uuid: string, inicio: string) {
  const ORG = "https://api.calendly.com/organizations/ORG1";
  const EVENT = "https://api.calendly.com/scheduled_events/EV9";
  return vi.fn(async (url: string) => {
    const ok = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
    if (url.includes("/users/me")) return ok({ resource: { current_organization: ORG } });
    if (url.includes(`${EVENT}/invitees`)) return ok({ collection: [{ uri: `${EVENT}/invitees/${uuid}`, status: "active" }] });
    if (url.includes("/scheduled_events")) return ok({ collection: [{ uri: EVENT, start_time: inicio, status: "active" }] });
    throw new Error(`URL inesperada: ${url}`);
  });
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;

  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" }).returning();
  programId = p.id;
  await sembrarEstadosDeLlegada(db, programId);

  // Cohorte activa que arranca el 15-oct: el tope del plazo de pago y la que se asigna sola.
  await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "Octubre",
      metaCupos: 10,
      precioUsd: "1500",
      fechaInicioClases: "2026-10-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-10",
      estado: "activo",
    });
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;

  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
  await db.insert(miembrosPrograma).values({ userId: closer, programId, activo: true });
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;

  const [w] = await db
    .insert(sources)
    .values({ programId, nombre: "Typeform Tactical", tipo: "webhook", proveedor: "typeform", secretoWebhook: SECRETO, activo: true, mapeoColumnas: { agenda: AGENDA } })
    .returning();
  webhookSourceId = w.id;
});

afterEach(async () => {
  holder.db = null;
  vi.unstubAllGlobals();
  await cerrar();
});

async function etapaDe(dealId: string) {
  const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  return d.etapa;
}

describe("E2 — la cita cae en su deal, el Grain lo atiende, el dinero lo mueve y anular lo devuelve", () => {
  it("recorrido completo con historial, saldo, cartera y estudiantes coherentes en cada paso", async () => {
    // 1. El envío firmado con una cita VIGENTE de Calendly abre el deal directo en Agendado,
    //    con su llamada colgada (huella `calendly:<uuid>`) y la fecha real de la cita.
    vi.stubGlobal("fetch", stubCalendly("inv-uuid-777", "2026-10-05T16:00:00Z"));
    expect((await enviar(envioConCita("inv-uuid-777"))).status).toBe(200);

    const [deal] = await db.select().from(deals);
    const dealId = deal.id;
    expect(deal.etapa).toBe("agendado");
    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamada).toMatchObject({ resultado: "agendada", huellaFila: "calendly:inv-uuid-777" });
    expect(llamada.fechaAgenda?.toISOString()).toBe("2026-10-05T16:00:00.000Z");

    // El closer reclama el deal (070, fuera de E2) y registra el descuento (074, la pantalla).
    await db.update(deals).set({ ownerUserId: closer, valorVendidoUsd: "1500.00", areaDeclaradaId: areaId }).where(eq(deals.id, dealId));

    // 2. El Grain de ESA llamada la marca como sucedida y pasa el deal a Atendido (T10).
    const grain = await pegarGrain(db, comoCloser(), { callId: llamada.id, linkGrain: "https://grain.com/share/recording/e2" });
    expect(grain).toMatchObject({ movioAAtendido: true, etapa: "atendido" });

    // Todavía no es estudiante ni cartera: no hay un solo abono.
    expect(await estudiantesDe(db, programId)).toHaveLength(0);
    expect((await carteraVencida(db, programId, HOY)).vencidos).toHaveLength(0);

    // 3. El primer abono lleva el deal a Abonado, le asigna la cohorte activa y queda 1.100 por pagar.
    const primero = await registrarAbono(db, comoCloser(), {
      dealId,
      fecha: "2026-10-06",
      monto: "400",
      comprobanteUrl: "https://drive.google.com/comprobante-1",
    });
    expect(primero).toMatchObject({ etapa: "ganado_parcial", movioElDeal: true, saldo: 1100, cohorteAsignada: null });
    expect((await estudiantesDe(db, programId)).map((e) => [e.dealId, e.etapa, e.codigoCohorte])).toEqual([[dealId, "ganado_parcial", "Octubre"]]);

    // El acuerdo de pago: la fecha límite no puede pasar del inicio de clases (15-oct).
    await expect(editarAcuerdoDePago(db, comoCloser(), { dealId, fechaLimitePago: "2026-10-16" })).rejects.toMatchObject({ status: 422 });
    await editarAcuerdoDePago(db, comoCloser(), { dealId, acuerdoPago: "El resto antes de clases", fechaLimitePago: "2026-10-12" });

    // 4. Con la fecha límite pasada y saldo, el deal sale en la cartera vencida, con el saldo del módulo.
    const cartera = await carteraVencida(db, programId, HOY);
    expect(cartera.vencidos).toHaveLength(1);
    expect(cartera.vencidos[0]).toMatchObject({ dealId, saldo: 1100, fechaLimite: "2026-10-12", diasDeAtraso: 8 });

    // 5. Un sobrepago se rechaza con la misma cifra; el abono exacto que salda lleva a Completo.
    await expect(
      registrarAbono(db, comoCloser(), { dealId, fecha: "2026-10-13", monto: "1100.01", comprobanteUrl: "https://drive.google.com/x" }),
    ).rejects.toMatchObject({ status: 422 });
    const cierre = await registrarAbono(db, comoCloser(), {
      dealId,
      fecha: "2026-10-13",
      monto: "1100",
      comprobanteUrl: "https://drive.google.com/comprobante-2",
    });
    expect(cierre).toMatchObject({ etapa: "ganado_completo", movioElDeal: true, saldo: 0 });
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toMatchObject({ abonado: 1500, saldo: 0 });
    // Ya pagó todo: deja la cartera y sigue siendo estudiante.
    expect((await carteraVencida(db, programId, HOY)).vencidos).toHaveLength(0);
    expect((await estudiantesDe(db, programId)).map((e) => e.etapa)).toEqual(["ganado_completo"]);

    // 6. El onboarding lo marca el closer; el gerente puede borrar la marca; se puede volver a poner.
    await marcarOnboarded(db, comoCloser(), { dealId });
    expect((await estudiantesDe(db, programId))[0].onboardedAt).not.toBeNull();
    await desmarcarOnboarded(db, { userId: gerente, rol: "gerente" }, { dealId });
    expect((await estudiantesDe(db, programId))[0].onboardedAt).toBeNull();

    // 7. Anular el abono que cerró el deal lo saca de Completo: vuelve a Abonado y a la cartera.
    const anulado = await anularAbono(db, comoCloser(), { abonoId: cierre.abonoId, motivo: "El comprobante era de otro cliente" });
    expect(anulado).toMatchObject({ etapa: "ganado_parcial", movioElDeal: true });
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toMatchObject({ abonado: 400, saldo: 1100 });
    expect((await carteraVencida(db, programId, HOY)).vencidos.map((v) => v.dealId)).toEqual([dealId]);

    // 8. Y anular el primero (el único que queda) lo devuelve a donde estaba antes de pagar.
    const vuelta = await anularAbono(db, comoCloser(), { abonoId: primero.abonoId, motivo: "Duplicado" });
    expect(vuelta).toMatchObject({ etapa: "atendido", movioElDeal: true });
    expect(await etapaDe(dealId)).toBe("atendido");
    expect(await estudiantesDe(db, programId)).toHaveLength(0);
    expect((await carteraVencida(db, programId, HOY)).vencidos).toHaveLength(0);

    // 9. La historia entera del deal, en orden, y nada escrito fuera del motor.
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId)).orderBy(dealEtapaHistorial.fecha);
    expect(historial.map((h) => [h.de, h.a])).toEqual([
      [null, "agendado"], // el alta del sistema, desde la cita de Calendly
      ["agendado", "atendido"], // el Grain
      ["atendido", "ganado_parcial"], // el primer abono
      ["ganado_parcial", "ganado_completo"], // el abono que salda
      ["ganado_completo", "ganado_parcial"], // A2: se anula el que cerró
      ["ganado_parcial", "atendido"], // A1: se anula el único que queda
    ]);
    // Los movimientos del dinero los toma el sistema, y ninguno lo hizo una persona a mano.
    expect(historial.slice(1).filter((h) => h.userId !== null).map((h) => h.a)).toEqual([]);

    // 10. Cada abono anulado conserva quién y por qué, y el rastro de cada escritura existe.
    const todos = await db.select().from(abonos).where(and(eq(abonos.dealId, dealId), incluyendoAnulados(abonos)));
    expect(todos.map((a) => a.motivoAnulacion).sort()).toEqual(["Duplicado", "El comprobante era de otro cliente"]);
    expect(todos.every((a) => a.anuladoPor === closer)).toBe(true);
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, dealId)));
    const campos = new Set(rastro.map((r) => r.campo));
    for (const campo of ["cohortId", "acuerdoPago", "fechaLimitePago", "onboardedAt"]) expect(campos.has(campo)).toBe(true);
  });
});
