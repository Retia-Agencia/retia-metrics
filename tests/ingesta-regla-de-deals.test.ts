import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  calls,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  programs,
  sources,
  submissions,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import type { Calificacion } from "@/lib/ingesta/calificacion";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { decidirAccionDeDeal, type ResultadoCita } from "@/lib/ingesta/regla-de-deals";
import { esViolacionCheck } from "@/lib/db/errores";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA, sembrarEstadosDeLlegada } from "./helpers/programa-de-prueba";
import { estadosDeLlegada } from "@/lib/catalogo/estados-llegada";
import { users } from "@/lib/db/schema";
import { sinComentarios } from "./helpers/codigo-fuente";


/**
 * La regla de creacion y movimiento de deals (ticket 052, insumo §3.1, ADR 0037,
 * ADR 0049, ADR 0057).
 *
 * Dos capas: la decision PURA (`decidirAccionDeDeal`), que se prueba con la tabla del
 * insumo fila por fila sin base, y la delegacion al motor (`aplicarReglaDeDeal` via
 * `ingerirEntradas`), contra PGlite con TODAS las migraciones, que verifica que el deal
 * nace/mueve por el motor, deja su fila de historial y —para "Con Calendly"— crea su
 * llamada con la fecha de la cita, y que NUNCA corre cuando el llamador no la pide.
 */

/** Una cita vigente para las pruebas puras y de integracion. */
const CITA_VIGENTE: ResultadoCita = {
  estado: "vigente",
  inicio: new Date("2026-10-01T15:00:00Z"),
  uuidInvitado: "UU-1",
};

// ─────────────────────────────────────────────── la decision pura (sin base)

describe("decidirAccionDeDeal: la tabla del insumo §3.1, fila por fila", () => {
  // La decision lee la ETAPA DE ENTRADA de la fila del Estado (ticket 117), no un valor.
  const SETTEO = { etapaEntrada: "registrado" as const };
  const AGENDADO = { etapaEntrada: "agendado" as const };
  const NO_ABRE = { etapaEntrada: null };
  const conDeal = (
    etapa: import("@/lib/deals/etapas").EtapaDeal,
    pendiente: import("@/lib/deals/etapas").PendienteDeal | null = null,
  ) => ({ etapa, pendiente });

  it("una fila que no abre deal (etapa nula) no abre nada, tenga o no deal", () => {
    expect(decidirAccionDeDeal(NO_ABRE, null).tipo).toBe("nada");
    expect(decidirAccionDeDeal(NO_ABRE, conDeal("agendado")).tipo).toBe("nada");
  });

  it("sin fila (vacio o desconocido) no abre nada: no se adivina un deal", () => {
    expect(decidirAccionDeDeal(null, null).tipo).toBe("nada");
    expect(decidirAccionDeDeal(null, conDeal("registrado")).tipo).toBe("nada");
  });

  it("entra en Setteo sin deal abre en esa etapa", () => {
    expect(decidirAccionDeDeal(SETTEO, null)).toEqual({
      tipo: "abrir",
      etapa: "registrado",
    });
  });

  it("entra en Setteo con deal abierto no hace nada", () => {
    expect(decidirAccionDeDeal(SETTEO, conDeal("registrado")).tipo).toBe("nada");
  });

  it("entra en Agendado + cita vigente, sin deal, abre en Agendado con la llamada", () => {
    expect(decidirAccionDeDeal(AGENDADO, null, CITA_VIGENTE)).toEqual({
      tipo: "abrir",
      etapa: "agendado",
      llamada: { inicio: CITA_VIGENTE.inicio, uuidInvitado: "UU-1" },
    });
  });

  it.each([
    ["registrado", null],
    ["contactado", null],
    ["agendado", "reagenda"],
    ["registrado", "proxima_cohorte"],
    ["atendido", "seguimiento"],
  ] as const)(
    "entra en Agendado + cita vigente con deal en %s/%s mueve a Agendado con la llamada",
    (etapa, pendiente) => {
      expect(decidirAccionDeDeal(AGENDADO, conDeal(etapa, pendiente), CITA_VIGENTE)).toMatchObject({
        tipo: "mover",
        a: "agendado",
        llamada: { inicio: CITA_VIGENTE.inicio, uuidInvitado: "UU-1" },
      });
    },
  );

  it.each(["agendado", "atendido", "compromiso_verbal", "ganado_parcial"] as const)(
    "entra en Agendado + cita vigente con deal en %s (4, 5, 6 o 7) agrega la llamada, sin mover",
    (etapa) => {
      // Mani, 28-sep: una re-agenda con cita nueva no se pierde. El deal no se mueve.
      expect(decidirAccionDeDeal(AGENDADO, conDeal(etapa), CITA_VIGENTE)).toMatchObject({
        tipo: "agregar_llamada",
        etapa,
        llamada: { inicio: CITA_VIGENTE.inicio, uuidInvitado: "UU-1" },
      });
    },
  );

  it.each(["agendado", "atendido", "compromiso_verbal", "ganado_parcial"] as const)(
    "entra en Agendado + cita NO vigente con deal en %s (4, 5, 6 o 7) notifica re-envio, sin mover",
    (etapa) => {
      expect(decidirAccionDeDeal(AGENDADO, conDeal(etapa), { estado: "cancelada" })).toMatchObject({
        tipo: "notificar_reenvio",
        etapa,
      });
    },
  );

  it("entra en Agendado con deal en Pendiente Re-agenda o Seguimiento + cita vigente SÍ mueve (regresión A1 del 114)", () => {
    // Antes 3 y 11 no estaban en la lista de la ingesta (era 1/2/9), así que un
    // re-envío con cita válida caía en la rama `nada`. Con la lista única de
    // `lib/deals/etapas.ts` avanzan por T6 y T27.
    expect(decidirAccionDeDeal(AGENDADO, conDeal("agendado", "reagenda"), CITA_VIGENTE).tipo).toBe("mover");
    expect(decidirAccionDeDeal(AGENDADO, conDeal("atendido", "seguimiento"), CITA_VIGENTE).tipo).toBe("mover");
  });

  it("entra en Agendado sin deal + cita CANCELADA abre en Calificado con nota", () => {
    expect(decidirAccionDeDeal(AGENDADO, null, { estado: "cancelada" })).toEqual({
      tipo: "abrir",
      etapa: "calificado",
      nota: "La cita de Calendly está cancelada.",
    });
  });

  it("entra en Agendado sin deal + cita NO ENCONTRADA abre en Calificado con nota", () => {
    expect(decidirAccionDeDeal(AGENDADO, null, { estado: "no_encontrada" })).toEqual({
      tipo: "abrir",
      etapa: "calificado",
      nota: "No se encontró la cita en Calendly.",
    });
  });

  it("entra en Agendado sin deal + ERROR de Calendly abre en Calificado con nota que trae el mensaje", () => {
    expect(decidirAccionDeDeal(AGENDADO, null, { estado: "error", mensaje: "token vencido." })).toEqual({
      tipo: "abrir",
      etapa: "calificado",
      nota: "No se pudo consultar Calendly: token vencido.",
    });
  });

  it("entra en Agendado con deal en Registrado + cita no vigente: no mueve, deja nota", () => {
    const r = decidirAccionDeDeal(AGENDADO, conDeal("registrado"), { estado: "cancelada" });
    expect(r.tipo).toBe("nada");
    expect(r.tipo === "nada" && r.nota).toBe("La cita de Calendly está cancelada.");
  });

  it("entra en Agendado sin cita resuelta (indefinida) se trata como no encontrada", () => {
    expect(decidirAccionDeDeal(AGENDADO, null)).toEqual({
      tipo: "abrir",
      etapa: "calificado",
      nota: "No se encontró la cita en Calendly.",
    });
  });
});

// ─────────────────────────────────────────────── la delegacion (contra PGlite)

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;

const CAMPOS = {
  token: "Token",
  correo: "Correo",
  telefono: "WhatsApp",
  fechaEnvio: "Submitted At",
  estadoHoja: "Estado",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
} as const;

/** Una entrada con forma de fila de hoja. */
function entrada(o: {
  token: string;
  correo?: string;
  fecha?: string | null;
  estado?: Calificacion | string;
  esParcial?: boolean;
  /** Respuestas no promovidas, las que un parcial va acumulando pregunta a pregunta. */
  extra?: Record<string, string>;
}): EntradaEnvio {
  return {
    sourceId,
    zona: "UTC",
    posicion: null,
    esParcial: o.esParcial,
    columnas: {
      Token: o.token,
      Correo: o.correo ?? "",
      WhatsApp: "",
      "Submitted At": o.fecha === null ? "1/1/0001 0:00:00" : (o.fecha ?? "2026-09-20T15:00:00Z"),
      Estado: o.estado ?? "",
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
      ...o.extra,
    },
    campos: { ...CAMPOS },
  };
}

/** El mapa de citas por correo que el webhook arma fuera de la transacción. */
function citas(correo: string, cita: ResultadoCita): Map<string, ResultadoCita> {
  return new Map([[correo, cita]]);
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" }).returning();
  programId = p.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform", tipo: "google_sheet" }).returning();
  sourceId = f.id;
  await sembrarEstadosDeLlegada(db, programId);
});

afterEach(async () => {
  await cerrar();
});

/** El lead recién ingerido, para leer su calificación y su id. */
async function leadDeCorreo(correo: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.emailNormalizado, correo));
  return lead;
}

describe("aplicarReglaDeDeals via ingerirEntradas", () => {
  it("con la opción en FALSE (default), no se abre ningún deal", async () => {
    const r = await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" }),
      entrada({ token: "t2", correo: "beto@correo.co", estado: "con_calendly" }),
    ]);
    expect(r.reglaDeDeals).toEqual([]);
    expect(await db.select().from(deals)).toHaveLength(0);
    // La calificación sí se guardó: la regla es lo único que no corrió.
    expect((await leadDeCorreo("ana@correo.co")).calificacion).toBe("setteo_no_calificado");
  });

  it("setteo_no_calificado abre un deal en Pendiente Setteo, por el motor y con historial", async () => {
    const r = await ingerirEntradas(
      db,
      programId,
      [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })],
      { aplicarReglaDeDeals: true },
    );

    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("registrado");
    expect(deal.ownerUserId).toBeNull(); // sistema abre Unclaimed
    expect(deal.creadoPor).toBeNull(); // nulo = lo abrió el sistema

    // Su PRIMERA fila de historial: `de` nulo, `a` = registrado, sin usuario.
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    expect(historial).toHaveLength(1);
    expect(historial[0].de).toBeNull();
    expect(historial[0].a).toBe("registrado");
    expect(historial[0].userId).toBeNull();

    expect(r.reglaDeDeals).toHaveLength(1);
    expect(r.reglaDeDeals[0].accion).toEqual({ tipo: "abrir", etapa: "registrado" });
    expect(r.reglaDeDeals[0].dealAbiertoId).toBe(deal.id);
  });

  it("con_calendly + cita vigente, sin deal, abre en Agendado con historial y CREA su llamada", async () => {
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });

    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    expect(historial).toHaveLength(1);
    expect(historial[0].de).toBeNull();
    expect(historial[0].a).toBe("agendado");

    // La llamada de Calendly, colgada del deal, con la fecha real, sin closer.
    const filasCall = await db.select().from(calls).where(eq(calls.dealId, deal.id));
    expect(filasCall).toHaveLength(1);
    expect(filasCall[0].resultado).toBe("agendada");
    expect(filasCall[0].fechaAgenda?.toISOString()).toBe(CITA_VIGENTE.inicio.toISOString());
    expect(filasCall[0].closerId).toBeNull();
    expect(filasCall[0].origen).toBe("calendly");
    expect(filasCall[0].huellaFila).toBe("calendly:UU-1");

    expect(r.reglaDeDeals[0].accion.tipo).toBe("abrir");
  });

  it("un COMPLETO sin estado (sin calificación) no abre deal", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co" })], {
      aplicarReglaDeDeals: true,
    });
    expect((await leadDeCorreo("ana@correo.co")).calificacion).toBeNull();
    expect(await db.select().from(deals)).toHaveLength(0);
  });

  it("con_calendly desde Setteo + cita vigente MUEVE a Agendado, crea la llamada y deja su fila de historial", async () => {
    // Los 9 casos de dev: un lead con deal en Pendiente Setteo que re-aplica Con Calendly.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));

    // Re-envío Con Calendly del MISMO lead: la regla crea la llamada con la fecha de la
    // cita (T2 exige `llamada_con_fecha`, que ahora se cumple sola).
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });

    const [movido] = await db.select().from(deals).where(eq(deals.id, deal.id));
    expect(movido.etapa).toBe("agendado");

    const historial = await db
      .select()
      .from(dealEtapaHistorial)
      .where(and(eq(dealEtapaHistorial.dealId, deal.id), eq(dealEtapaHistorial.a, "agendado")));
    expect(historial).toHaveLength(1);
    expect(historial[0].de).toBe("registrado");
    expect(historial[0].userId).toBeNull(); // lo movió el sistema

    // La llamada la creó la regla (huella determinista por invitado).
    const filasCall = await db.select().from(calls).where(eq(calls.dealId, deal.id));
    expect(filasCall).toHaveLength(1);
    expect(filasCall[0].huellaFila).toBe("calendly:UU-1");

    expect(r.reglaDeDeals[0].accion.tipo).toBe("mover");
    expect(r.reglaDeDeals[0].rechazo).toBeUndefined();
  });

  it("con_calendly desde Setteo + cita CANCELADA: no mueve, el deal se queda en Pendiente Setteo con nota", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");

    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", { estado: "cancelada" }),
    });

    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(deal.etapa).toBe("registrado"); // no se movió, no retrocede
    expect(await db.select().from(calls).where(eq(calls.dealId, deal.id))).toHaveLength(0);
    expect(r.reglaDeDeals[0].accion.tipo).toBe("nada");
    expect(r.reglaDeDeals[0].nota).toBe("La cita de Calendly está cancelada.");
    // La nota queda ESCRITA en el deal, con el sistema como actor (migración 0032).
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id));
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({ tipo: "nota", userId: null, nota: "La cita de Calendly está cancelada." });
    // El envío completo Con Calendly sí quedó guardado (la ingesta no se deshizo).
    expect((await leadDeCorreo("ana@correo.co")).calificacion).toBe("con_calendly");
  });

  it("con_calendly desde Setteo + ERROR de Calendly: no mueve, deja nota con el mensaje", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");

    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", { estado: "error", mensaje: "Calendly respondió 500." }),
    });

    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(deal.etapa).toBe("registrado");
    expect(r.reglaDeDeals[0].nota).toBe("No se pudo consultar Calendly: Calendly respondió 500.");
  });

  // ─────────────── regresión A1 del ticket 114: 3 y 11 sí avanzan a Agendado ───────────────
  //
  // Antes la ingesta tenía su propia lista 1/2/9 (escrita antes de Seguimiento), así que
  // un lead en Pendiente Re-agenda (3, T6) o en Seguimiento (11, T27) que re-enviaba el
  // formulario con una cita válida NO pasaba a Agendado. Con la lista única de
  // `lib/deals/etapas.ts` sí avanza y crea su llamada de Calendly.
  it.each([
    ["agendado", "reagenda"],
    ["atendido", "seguimiento"],
  ] as const)("con_calendly desde %s/%s + cita vigente MUEVE a Agendado y crea la llamada", async (etapa, pendiente) => {
    // Un deal abierto del lead, llevado a la etapa de origen directo en la base (solo
    // prepara el estado; el motor exige únicamente `llamada_con_fecha` para T6/T27, y
    // esa la crea la propia regla antes de mover).
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    await db.update(deals).set({ etapa, pendiente }).where(eq(deals.id, deal.id));

    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });

    const [movido] = await db.select().from(deals).where(eq(deals.id, deal.id));
    expect(movido.etapa).toBe("agendado");

    // La fila de historial del movimiento, desde la etapa de origen, por el sistema.
    const historial = await db
      .select()
      .from(dealEtapaHistorial)
      .where(and(eq(dealEtapaHistorial.dealId, deal.id), eq(dealEtapaHistorial.a, "agendado")));
    expect(historial).toHaveLength(1);
    expect(historial[0].de).toBe(etapa);
    expect(historial[0].userId).toBeNull();

    // La llamada de Calendly, colgada del deal, con la fecha real de la cita.
    const filasCall = await db.select().from(calls).where(eq(calls.dealId, deal.id));
    expect(filasCall).toHaveLength(1);
    expect(filasCall[0].huellaFila).toBe("calendly:UU-1");

    expect(r.reglaDeDeals[0].accion.tipo).toBe("mover");
    expect(r.reglaDeDeals[0].rechazo).toBeUndefined();
  });

  it("un re-envío del mismo Con Calendly NO duplica la llamada (huella idempotente)", async () => {
    // Primer envío: abre deal en Agendado y crea la llamada.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(await db.select().from(calls).where(eq(calls.dealId, deal.id))).toHaveLength(1);

    // Segundo envío idéntico: el deal ya está en Agendado (avanzado, no se mueve) y la
    // huella `calendly:UU-1` impide crear una segunda llamada.
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });
    expect(await db.select().from(calls).where(eq(calls.dealId, deal.id))).toHaveLength(1);
    expect(r.reglaDeDeals[0].accion.tipo).toBe("agregar_llamada");
  });

  it("con_calendly con el deal ya avanzado (Agendado) NO mueve y agrega la llamada de la cita", async () => {
    // Lead con deal, llevado a Agendado (etapa 4, "avanzada") con su cita vigente.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    let [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));

    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });
    [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(deal.etapa).toBe("agendado"); // ya avanzado (4)

    // Otro re-envío Con Calendly: el deal ya está en 'agendado' (avanzada), no se mueve.
    const historialAntes = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });
    const historialDespues = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    expect(historialDespues).toHaveLength(historialAntes.length); // no hubo movimiento
    expect(r.reglaDeDeals[0].accion).toMatchObject({ tipo: "agregar_llamada", etapa: "agendado" });
  });

  it("un lead con deal completo (cerrado) es 'sin deal abierto': con_calendly abre uno NUEVO en Agendado", async () => {
    // Un deal cerrado no ocupa el cupo (ADR 0037). Si el lead re-aplica Con Calendly con
    // cita vigente, nace un deal nuevo en Agendado.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [primero] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    // Lo cerramos directo en la base (no es lo que prueba este test; solo prepara el estado).
    await db.update(deals).set({ etapa: "cierre_perdido" }).where(eq(deals.id, primero.id));

    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE),
    });
    const abiertos = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(abiertos).toHaveLength(2);
    expect(abiertos.some((d) => d.etapa === "agendado")).toBe(true);
    expect(r.reglaDeDeals[0].accion.tipo).toBe("abrir");
  });
});

// ─────────────────────────────────────────────── los Estados de llegada por tabla (117)

describe("los Estados de llegada salen de la tabla, no del codigo (ticket 117, ADR 0061)", () => {
  const ingerir = (entradas: EntradaEnvio[], extra: Parameters<typeof ingerirEntradas>[3] = {}) =>
    ingerirEntradas(db, programId, entradas, { aplicarReglaDeDeals: true, ...extra });

  async function actor(): Promise<string> {
    const [u] = await db.insert(users).values({ email: "gerente@retia.co", nombre: "Gerente", rol: "gerente" }).returning();
    return u.id;
  }

  it("un valor NUEVO en la tabla abre deals en su etapa, sin tocar codigo", async () => {
    await estadosDeLlegada(db).crear(await actor(), {
      programId,
      valor: "lead_premium",
      etapaEntrada: "registrado",
      prioridad: "alta",
      alertaMinutos: 10,
    });
    const r = await ingerir([entrada({ token: "t1", correo: "ana@correo.co", estado: "Lead_Premium" })]);
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("registrado");
    expect(r.sinCalificar).toEqual([]);
    // El Estado se guarda como llego (ADR 0004); la comparacion es la del indice.
    expect((await leadDeCorreo("ana@correo.co")).calificacion).toBe("Lead_Premium");
  });

  it("🩸 sin estado o con un valor desconocido: lead sin deal, y se cuenta (el 29-sep de Tactical)", async () => {
    const r = await ingerir([
      entrada({ token: "t1", correo: "ana@correo.co", estado: "" }),
      entrada({ token: "t2", correo: "beto@correo.co", estado: "valor_que_nadie_configuro" }),
    ]);
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(await leadDeCorreo("ana@correo.co")).toBeDefined();
    expect(await leadDeCorreo("beto@correo.co")).toBeDefined();
    expect(r.sinCalificar).toEqual(
      expect.arrayContaining([
        { motivo: "sin estado", envios: 1 },
        { motivo: "estado no reconocido: valor_que_nadie_configuro", envios: 1 },
      ]),
    );
    expect(r.reglaDeDeals.every((x) => x.accion.tipo === "nada")).toBe(true);
  });

  it("una fila DESACTIVADA deja de reconocerse: no abre deal y se cuenta", async () => {
    const [fila] = (await estadosDeLlegada(db).listar()).filter((f) => f.valor === "setteo_no_calificado");
    await estadosDeLlegada(db).desactivar(await actor(), fila.id);
    const r = await ingerir([entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })]);
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(r.sinCalificar).toEqual([{ motivo: "estado no reconocido: setteo_no_calificado", envios: 1 }]);
  });

  it("una fila que dice que no abre deal se reconoce (no se cuenta) y no abre", async () => {
    const [fila] = (await estadosDeLlegada(db).listar()).filter((f) => f.valor === "descartado");
    await estadosDeLlegada(db).editar(await actor(), fila.id, {
      programId,
      valor: "descartado",
      etapaEntrada: null,
      prioridad: "normal",
      alertaMinutos: null,
    });
    const r = await ingerir([entrada({ token: "t1", correo: "ana@correo.co", estado: "descartado" })]);
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(r.sinCalificar).toEqual([]);
  });

  it("descartado (sembrado en Setteo) abre deal: todo el que llena el formulario es contacto", async () => {
    await ingerir([entrada({ token: "t1", correo: "ana@correo.co", estado: "descartado" })]);
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("registrado");
  });

  it("la frontera: el Estado de OTRO programa no se reconoce aqui", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "797" }).returning();
    await sembrarEstadosDeLlegada(db, otro.id, [
      { valor: "solo_del_otro", etapaEntrada: "registrado", prioridad: "normal", alertaMinutos: null },
    ]);
    const r = await ingerir([entrada({ token: "t1", correo: "ana@correo.co", estado: "solo_del_otro" })]);
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(r.sinCalificar).toEqual([{ motivo: "estado no reconocido: solo_del_otro", envios: 1 }]);
  });

  it("parcial SIN estado (el del WhatsApp): lead sin deal, y no se cuenta como error", async () => {
    const r = await ingerir([entrada({ token: "t1", correo: "ana@correo.co", estado: "", esParcial: true })]);
    expect(await leadDeCorreo("ana@correo.co")).toBeDefined();
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(r.sinCalificar).toEqual([]);
  });

  it("parcial con_calendly_sin_agenda y luego su completa con cita: un lead, un deal, en Agendado con su llamada", async () => {
    const parcial = await ingerir([
      entrada({ token: "tok-1", correo: "ana@correo.co", estado: "con_calendly_sin_agenda", esParcial: true, fecha: null }),
    ]);
    expect(parcial.reglaDeDeals[0].accion).toEqual({ tipo: "abrir", etapa: "calificado" });
    const [enSetteo] = await db.select().from(deals);
    expect(enSetteo.etapa).toBe("calificado");

    // La completa del MISMO token, con la cita: el mismo deal pasa a Agendado por el motor.
    const completa = await ingerir(
      [entrada({ token: "tok-1", correo: "ana@correo.co", estado: "con_calendly", esParcial: false })],
      { citasPorCorreo: citas("ana@correo.co", CITA_VIGENTE) },
    );
    expect(completa.reglaDeDeals[0].accion.tipo).toBe("mover");
    expect(await db.select().from(leads)).toHaveLength(1);
    const todos = await db.select().from(deals);
    expect(todos).toHaveLength(1);
    expect(todos[0].id).toBe(enSetteo.id);
    expect(todos[0].etapa).toBe("agendado");
    const llamadas = await db.select().from(calls).where(eq(calls.dealId, enSetteo.id));
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].fechaAgenda?.toISOString()).toBe(CITA_VIGENTE.inicio.toISOString());
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, enSetteo.id));
    expect(historial.map((h) => h.a)).toEqual(["calificado", "agendado"]);
  });

  describe("🩸 los dos puntos parciales comparten token: el viejo no pisa al nuevo (revisión de Codex)", () => {
    // El del WhatsApp llega con menos respuestas y sin Estado; el previo al Calendly, con mas
    // respuestas y `con_calendly_sin_agenda`. Son VERSIONES de la misma fila.
    const whatsapp = () =>
      entrada({ token: "tok-1", correo: "ana@correo.co", estado: "", esParcial: true, fecha: null, extra: { Ingreso: "1000" } });
    const calendly = () =>
      entrada({
        token: "tok-1",
        correo: "ana@correo.co",
        estado: "con_calendly_sin_agenda",
        esParcial: true,
        fecha: null,
        extra: { Ingreso: "1000", Motivo: "crecer", Urgencia: "ya" },
      });

    it("en orden: el del Calendly reemplaza al del WhatsApp y abre el deal", async () => {
      await ingerir([whatsapp()]);
      expect(await db.select().from(deals)).toHaveLength(0);
      await ingerir([calendly()]);
      const [envio] = await db.select().from(submissions);
      expect(envio.calificacion).toBe("con_calendly_sin_agenda");
      expect(await db.select().from(deals)).toHaveLength(1);
    });

    it("fuera de orden: el del WhatsApp que llega tarde no le borra el Estado ni las respuestas", async () => {
      await ingerir([calendly()]);
      const [deal] = await db.select().from(deals);
      expect(deal.etapa).toBe("calificado");
      const r = await ingerir([whatsapp()]);
      const envios = await db.select().from(submissions);
      expect(envios).toHaveLength(1);
      expect(envios[0].calificacion).toBe("con_calendly_sin_agenda");
      expect(Object.keys(envios[0].respuestas as object)).toEqual(expect.arrayContaining(["Motivo", "Urgencia"]));
      expect(r.reglaDeDeals.every((x) => x.accion.tipo === "nada")).toBe(true);
      expect(await db.select().from(deals)).toHaveLength(1);
    });

    it.each([
      ["calendly, whatsapp", () => [calendly(), whatsapp()]],
      ["whatsapp, calendly", () => [whatsapp(), calendly()]],
    ] as const)("en UN mismo lote (%s) gana la version con mas respuestas", async (_orden, lote) => {
      await ingerir([...lote()]);
      const envios = await db.select().from(submissions);
      expect(envios).toHaveLength(1);
      expect(envios[0].calificacion).toBe("con_calendly_sin_agenda");
      expect(await db.select().from(deals)).toHaveLength(1);
    });

    it("el mismo parcial reintentado sí se re-escribe (idempotente)", async () => {
      await ingerir([calendly()]);
      await ingerir([calendly()]);
      expect(await db.select().from(submissions)).toHaveLength(1);
      expect(await db.select().from(deals)).toHaveLength(1);
    });
  });

  it("la regla decide con el Estado del ENVIO que la dispara, no con el resumen del lead", async () => {
    // Una completa vieja sin Estado que abra deal, y despues el parcial previo al Calendly:
    // el resumen del lead sigue siendo la completa, pero el parcial abre su deal.
    await ingerir([entrada({ token: "viejo", correo: "ana@correo.co", estado: "valor_viejo", fecha: "2026-09-01T10:00:00Z" })]);
    expect(await db.select().from(deals)).toHaveLength(0);
    await ingerir([entrada({ token: "nuevo", correo: "ana@correo.co", estado: "con_calendly_sin_agenda", esParcial: true, fecha: null })]);
    expect((await leadDeCorreo("ana@correo.co")).calificacion).toBe("valor_viejo");
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("calificado");
  });
});

describe("la nota del sistema en el deal (migración 0032)", () => {
  it("un deal NUEVO que abre en Calificado por cita no encontrada lleva su nota escrita", async () => {
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t9", correo: "beto@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: citas("beto@correo.co", { estado: "no_encontrada" }),
    });
    const dealId = r.reglaDeDeals[0].dealAbiertoId!;
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(notas).toMatchObject([{ tipo: "nota", userId: null, nota: "No se encontró la cita en Calendly." }]);
  });

  it("la base rechaza un CONTACTO sin usuario: el sistema solo deja notas", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t8", correo: "caro@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("caro@correo.co");
    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    const error = await db
      .insert(dealActividades)
      .values({ dealId: deal.id, tipo: "contacto", canal: "whatsapp", userId: null })
      .then(() => null, (e: unknown) => e);
    expect(esViolacionCheck(error)).toBe(true);
  });
});

// ─────────────── guardián: una sola lista de "desde qué etapas una cita mueve a Agendado" ───────────────
//
// La pregunta —hallazgo A1 del ticket 114— estaba copiada en tres módulos y la de la
// ingesta ya había divergido (1/2/9 en vez de 1/2/3/9/11). La respuesta vive UNA vez en
// `lib/deals/etapas.ts` (`unaCitaMueveAAgendado`) y los tres la importan.
// Este guardián falla si alguno vuelve a declarar su propia lista.
describe("guardián: la lista de etapas que una cita mueve a Agendado no se re-declara", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const CONSUMIDORES = [
    path.join("lib", "deals", "llamadas.ts"),
    path.join("lib", "calendly", "colgar-llamada.ts"),
    path.join("lib", "ingesta", "regla-de-deals.ts"),
  ];
  const NOMBRE_VIEJO = "ETAPAS_QUE_AVANZAN_A_AGENDADO";
  const NOMBRE_UNICO = "unaCitaMueveAAgendado";

  it.each(CONSUMIDORES)("%s ya no define su propia lista y usa la única", (rel) => {
    const codigo = sinComentarios(fs.readFileSync(path.join(RAIZ, rel), "utf8"));
    // El nombre local viejo no debe aparecer en ningún lado (ni declaración ni uso).
    expect(codigo).not.toContain(NOMBRE_VIEJO);
    // Y ninguno vuelve a declarar la función; la importa.
    expect(new RegExp(`function\\s+${NOMBRE_UNICO}\\b`).test(codigo)).toBe(false);
    // La referencia a la lista única sigue ahí (si no, no vigila nada).
    expect(codigo).toContain(NOMBRE_UNICO);
  });

  it("la única lista vive en lib/deals/etapas.ts, exportada", () => {
    const codigo = sinComentarios(fs.readFileSync(path.join(RAIZ, "lib", "deals", "etapas.ts"), "utf8"));
    expect(new RegExp(`export\\s+function\\s+${NOMBRE_UNICO}\\b`).test(codigo)).toBe(true);
  });
});

// ─────────────── guardián: RESULTADOS_FALLIDOS vive en un solo módulo ───────────────
//
// Hallazgo A3 del ticket 114: estaba copiada en `mover-etapa.ts` y en `llamadas.ts`. La
// definición única vive en `mover-etapa.ts` (el motor la lee para `llamada_fallida`) y
// `llamadas.ts` la re-exporta para no romper a quien la importa desde ahí.
describe("guardián: RESULTADOS_FALLIDOS se declara una sola vez", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));

  it("solo lib/deals/mover-etapa.ts declara la lista con sus valores", () => {
    const motor = sinComentarios(fs.readFileSync(path.join(RAIZ, "lib", "deals", "mover-etapa.ts"), "utf8"));
    const llamadas = sinComentarios(fs.readFileSync(path.join(RAIZ, "lib", "deals", "llamadas.ts"), "utf8"));
    const declaracion = /const\s+RESULTADOS_FALLIDOS\s*=\s*\[/;
    expect(declaracion.test(motor)).toBe(true);
    // llamadas.ts NO vuelve a declararla (solo la importa y re-exporta).
    expect(declaracion.test(llamadas)).toBe(false);
    expect(llamadas).toContain("RESULTADOS_FALLIDOS");
  });
});
