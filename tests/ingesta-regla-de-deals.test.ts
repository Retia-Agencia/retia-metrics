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
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import type { Calificacion } from "@/lib/ingesta/calificacion";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { decidirAccionDeDeal, type ResultadoCita } from "@/lib/ingesta/regla-de-deals";
import { esViolacionCheck } from "@/lib/db/errores";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
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
  const conDeal = (etapa: import("@/lib/deals/etapas").EtapaDeal) => ({ etapa });

  it("descartado no abre nada, tenga o no deal", () => {
    expect(decidirAccionDeDeal("descartado", null).tipo).toBe("nada");
    expect(decidirAccionDeDeal("descartado", conDeal("agendado")).tipo).toBe("nada");
  });

  it("sin calificacion no abre nada", () => {
    expect(decidirAccionDeDeal(null, null).tipo).toBe("nada");
    expect(decidirAccionDeDeal(null, conDeal("pendiente_setteo")).tipo).toBe("nada");
  });

  it("setteo_no_calificado sin deal abre en Pendiente Setteo", () => {
    expect(decidirAccionDeDeal("setteo_no_calificado", null)).toEqual({
      tipo: "abrir",
      etapa: "pendiente_setteo",
    });
  });

  it("setteo_no_calificado con deal abierto no hace nada", () => {
    expect(decidirAccionDeDeal("setteo_no_calificado", conDeal("pendiente_setteo")).tipo).toBe("nada");
  });

  it("con_calendly + cita vigente, sin deal, abre en Agendado con la llamada", () => {
    expect(decidirAccionDeDeal("con_calendly", null, CITA_VIGENTE)).toEqual({
      tipo: "abrir",
      etapa: "agendado",
      llamada: { inicio: CITA_VIGENTE.inicio, uuidInvitado: "UU-1" },
    });
  });

  it.each(["pendiente_setteo", "en_contacto", "pendiente_reagenda", "proxima_cohorte", "seguimiento"] as const)(
    "con_calendly + cita vigente con deal en %s (1, 2, 3, 9 u 11) mueve a Agendado con la llamada",
    (etapa) => {
      expect(decidirAccionDeDeal("con_calendly", conDeal(etapa), CITA_VIGENTE)).toEqual({
        tipo: "mover",
        a: "agendado",
        llamada: { inicio: CITA_VIGENTE.inicio, uuidInvitado: "UU-1" },
      });
    },
  );

  it.each(["agendado", "atendido", "compromiso_verbal", "abonado"] as const)(
    "con_calendly + cita vigente con deal en %s (4, 5, 6 o 7) agrega la llamada, sin mover",
    (etapa) => {
      // Mani, 28-sep: una re-agenda con cita nueva no se pierde. El deal no se mueve.
      expect(decidirAccionDeDeal("con_calendly", conDeal(etapa), CITA_VIGENTE)).toEqual({
        tipo: "agregar_llamada",
        etapa,
        llamada: { inicio: CITA_VIGENTE.inicio, uuidInvitado: "UU-1" },
      });
    },
  );

  it.each(["agendado", "atendido", "compromiso_verbal", "abonado"] as const)(
    "con_calendly + cita NO vigente con deal en %s (4, 5, 6 o 7) notifica re-envio, sin mover",
    (etapa) => {
      expect(decidirAccionDeDeal("con_calendly", conDeal(etapa), { estado: "cancelada" })).toEqual({
        tipo: "notificar_reenvio",
        etapa,
      });
    },
  );

  it("con_calendly con deal en Pendiente Re-agenda o Seguimiento + cita vigente SÍ mueve (regresión A1 del 114)", () => {
    // Antes 3 y 11 no estaban en la lista de la ingesta (era 1/2/9), así que un
    // re-envío con cita válida caía en la rama `nada`. Con la lista única de
    // `lib/deals/etapas.ts` avanzan por T6 y T27.
    expect(decidirAccionDeDeal("con_calendly", conDeal("pendiente_reagenda"), CITA_VIGENTE).tipo).toBe("mover");
    expect(decidirAccionDeDeal("con_calendly", conDeal("seguimiento"), CITA_VIGENTE).tipo).toBe("mover");
  });

  it("con_calendly sin deal + cita CANCELADA abre en Pendiente Setteo con nota", () => {
    expect(decidirAccionDeDeal("con_calendly", null, { estado: "cancelada" })).toEqual({
      tipo: "abrir",
      etapa: "pendiente_setteo",
      nota: "La cita de Calendly está cancelada.",
    });
  });

  it("con_calendly sin deal + cita NO ENCONTRADA abre en Pendiente Setteo con nota", () => {
    expect(decidirAccionDeDeal("con_calendly", null, { estado: "no_encontrada" })).toEqual({
      tipo: "abrir",
      etapa: "pendiente_setteo",
      nota: "No se encontró la cita en Calendly.",
    });
  });

  it("con_calendly sin deal + ERROR de Calendly abre en Pendiente Setteo con nota que trae el mensaje", () => {
    expect(decidirAccionDeDeal("con_calendly", null, { estado: "error", mensaje: "token vencido." })).toEqual({
      tipo: "abrir",
      etapa: "pendiente_setteo",
      nota: "No se pudo consultar Calendly: token vencido.",
    });
  });

  it("con_calendly con deal en Pendiente Setteo + cita no vigente: no mueve, deja nota", () => {
    const r = decidirAccionDeDeal("con_calendly", conDeal("pendiente_setteo"), { estado: "cancelada" });
    expect(r.tipo).toBe("nada");
    expect(r.tipo === "nada" && r.nota).toBe("La cita de Calendly está cancelada.");
  });

  it("con_calendly sin cita resuelta (indefinida) se trata como no encontrada", () => {
    expect(decidirAccionDeDeal("con_calendly", null)).toEqual({
      tipo: "abrir",
      etapa: "pendiente_setteo",
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
}): EntradaEnvio {
  return {
    sourceId,
    zona: "UTC",
    posicion: null,
    columnas: {
      Token: o.token,
      Correo: o.correo ?? "",
      WhatsApp: "",
      "Submitted At": o.fecha === null ? "1/1/0001 0:00:00" : (o.fecha ?? "2026-09-20T15:00:00Z"),
      Estado: o.estado ?? "",
      utm_source: "",
      utm_medium: "",
      utm_campaign: "",
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
    expect(deal.etapa).toBe("pendiente_setteo");
    expect(deal.ownerUserId).toBeNull(); // sistema abre Unclaimed
    expect(deal.creadoPor).toBeNull(); // nulo = lo abrió el sistema

    // Su PRIMERA fila de historial: `de` nulo, `a` = pendiente_setteo, sin usuario.
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    expect(historial).toHaveLength(1);
    expect(historial[0].de).toBeNull();
    expect(historial[0].a).toBe("pendiente_setteo");
    expect(historial[0].userId).toBeNull();

    expect(r.reglaDeDeals).toHaveLength(1);
    expect(r.reglaDeDeals[0].accion).toEqual({ tipo: "abrir", etapa: "pendiente_setteo" });
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

  it("descartado no crea deal, ni siquiera cerrado", async () => {
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "descartado" })], {
      aplicarReglaDeDeals: true,
    });
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(r.reglaDeDeals[0].accion.tipo).toBe("nada");
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
    expect(historial[0].de).toBe("pendiente_setteo");
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
    expect(deal.etapa).toBe("pendiente_setteo"); // no se movió, no retrocede
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
    expect(deal.etapa).toBe("pendiente_setteo");
    expect(r.reglaDeDeals[0].nota).toBe("No se pudo consultar Calendly: Calendly respondió 500.");
  });

  // ─────────────── regresión A1 del ticket 114: 3 y 11 sí avanzan a Agendado ───────────────
  //
  // Antes la ingesta tenía su propia lista 1/2/9 (escrita antes de Seguimiento), así que
  // un lead en Pendiente Re-agenda (3, T6) o en Seguimiento (11, T27) que re-enviaba el
  // formulario con una cita válida NO pasaba a Agendado. Con la lista única de
  // `lib/deals/etapas.ts` sí avanza y crea su llamada de Calendly.
  it.each([
    ["pendiente_reagenda"], // 3, T6
    ["seguimiento"], // 11, T27
  ] as const)("con_calendly desde %s + cita vigente MUEVE a Agendado y crea la llamada", async (etapa) => {
    // Un deal abierto del lead, llevado a la etapa de origen directo en la base (solo
    // prepara el estado; el motor exige únicamente `llamada_con_fecha` para T6/T27, y
    // esa la crea la propia regla antes de mover).
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    await db.update(deals).set({ etapa }).where(eq(deals.id, deal.id));

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

describe("la nota del sistema en el deal (migración 0032)", () => {
  it("un deal NUEVO que abre en Pendiente Setteo por cita no encontrada lleva su nota escrita", async () => {
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
// `lib/deals/etapas.ts` (`ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO`) y los tres la importan.
// Este guardián falla si alguno vuelve a declarar su propia lista.
describe("guardián: la lista de etapas que una cita mueve a Agendado no se re-declara", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const CONSUMIDORES = [
    path.join("lib", "deals", "llamadas.ts"),
    path.join("lib", "calendly", "colgar-llamada.ts"),
    path.join("lib", "ingesta", "regla-de-deals.ts"),
  ];
  const NOMBRE_VIEJO = "ETAPAS_QUE_AVANZAN_A_AGENDADO";
  const NOMBRE_UNICO = "ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO";

  it.each(CONSUMIDORES)("%s ya no define su propia lista y usa la única", (rel) => {
    const codigo = sinComentarios(fs.readFileSync(path.join(RAIZ, rel), "utf8"));
    // El nombre local viejo no debe aparecer en ningún lado (ni declaración ni uso).
    expect(codigo).not.toContain(NOMBRE_VIEJO);
    // Y ninguno declara una constante con la lista; la importa.
    expect(new RegExp(`const\\s+${NOMBRE_UNICO}\\b`).test(codigo)).toBe(false);
    // La referencia a la lista única sigue ahí (si no, no vigila nada).
    expect(codigo).toContain(NOMBRE_UNICO);
  });

  it("la única lista vive en lib/deals/etapas.ts, exportada", () => {
    const codigo = sinComentarios(fs.readFileSync(path.join(RAIZ, "lib", "deals", "etapas.ts"), "utf8"));
    expect(new RegExp(`export\\s+const\\s+${NOMBRE_UNICO}\\b`).test(codigo)).toBe(true);
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
