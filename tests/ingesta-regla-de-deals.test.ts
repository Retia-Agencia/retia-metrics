import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
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
import { decidirAccionDeDeal } from "@/lib/ingesta/regla-de-deals";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * La regla de creacion y movimiento de deals (ticket 052, insumo §3.1, ADR 0037).
 *
 * Dos capas: la decision PURA (`decidirAccionDeDeal`), que se prueba con la tabla del
 * insumo fila por fila sin base, y la delegacion al motor (`aplicarReglaDeDeal` via
 * `ingerirEntradas`), contra PGlite con TODAS las migraciones, que verifica que el deal
 * nace/mueve por el motor y deja su fila de historial — y que NUNCA corre cuando el
 * llamador no la pide (`aplicarReglaDeDeals` en false, el traslado desde Sheets).
 */

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

  it("con_calendly sin deal abre en Agendado", () => {
    expect(decidirAccionDeDeal("con_calendly", null)).toEqual({ tipo: "abrir", etapa: "agendado" });
  });

  it.each(["pendiente_setteo", "en_contacto", "proxima_cohorte"] as const)(
    "con_calendly con deal en %s (1, 2 o 9) mueve a Agendado",
    (etapa) => {
      expect(decidirAccionDeDeal("con_calendly", conDeal(etapa))).toEqual({ tipo: "mover", a: "agendado" });
    },
  );

  it.each(["agendado", "atendido", "compromiso_verbal", "abonado"] as const)(
    "con_calendly con deal en %s (4, 5, 6 o 7) notifica re-envio, sin mover",
    (etapa) => {
      expect(decidirAccionDeDeal("con_calendly", conDeal(etapa))).toEqual({
        tipo: "notificar_reenvio",
        etapa,
      });
    },
  );

  it("con_calendly con deal en una etapa que ni avanza ni es avanzada no hace nada", () => {
    // Pendiente Re-agenda (3) no está en 1/2/9 ni en 4/5/6/7: no se toca.
    expect(decidirAccionDeDeal("con_calendly", conDeal("pendiente_reagenda")).tipo).toBe("nada");
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

  it("con_calendly sin deal abre un deal en Agendado, por el motor y con historial", async () => {
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
    });

    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    expect(historial).toHaveLength(1);
    expect(historial[0].de).toBeNull();
    expect(historial[0].a).toBe("agendado");
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

  it("con_calendly desde Setteo (deal con llamada agendada) MUEVE a Agendado y deja su fila de historial", async () => {
    // Los 9 casos de dev: un lead con deal en Pendiente Setteo que re-aplica Con Calendly.
    // Primero el lead y su deal en Pendiente Setteo (por el motor).
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));

    // T2 (pendiente_setteo → agendado) exige una llamada con fecha; en producción la trae
    // Calendly (ticket 096). Aquí la sembramos para que el movimiento sea posible.
    await db.insert(calls).values({
      dealId: deal.id,
      programId,
      resultado: "agendada",
      fechaAgenda: new Date("2026-10-01T15:00:00Z"),
    });

    // Re-envío Con Calendly del MISMO lead.
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
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

    expect(r.reglaDeDeals[0].accion).toEqual({ tipo: "mover", a: "agendado" });
    expect(r.reglaDeDeals[0].rechazo).toBeUndefined();
  });

  it("con_calendly desde Setteo SIN llamada: el motor rechaza el movimiento, el envío sobrevive", async () => {
    // Sin la llamada de Calendly, T2 no se puede tomar. La regla NO tumba la ingesta: el
    // deal se queda en Pendiente Setteo y el rechazo queda reportado.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");

    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
    });

    const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(deal.etapa).toBe("pendiente_setteo"); // no se movió
    expect(r.reglaDeDeals[0].accion).toEqual({ tipo: "mover", a: "agendado" });
    expect(r.reglaDeDeals[0].rechazo).toBeTruthy();
    // El envío completo Con Calendly sí quedó guardado (la ingesta no se deshizo).
    expect((await leadDeCorreo("ana@correo.co")).calificacion).toBe("con_calendly");
  });

  it("con_calendly con el deal ya avanzado (Atendido) NO mueve y reporta notificar_reenvio", async () => {
    // Lead con deal, movido a Atendido por fuera de la regla (setup con el motor).
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    let [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));

    // Primero llevamos el deal a 'agendado' (etapa 4, "avanzada") por el motor: para eso
    // necesita una llamada con fecha (la trae Calendly en producción, ticket 096).
    await db.insert(calls).values({
      dealId: deal.id,
      programId,
      resultado: "agendada",
      fechaAgenda: new Date("2026-10-01T15:00:00Z"),
    });
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
    });
    [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(deal.etapa).toBe("agendado"); // ya avanzado (4)

    // Otro re-envío Con Calendly: el deal ya está en 'agendado' (avanzada), no se mueve.
    const historialAntes = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
    });
    const historialDespues = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, deal.id));
    expect(historialDespues).toHaveLength(historialAntes.length); // no hubo movimiento
    expect(r.reglaDeDeals[0].accion).toEqual({ tipo: "notificar_reenvio", etapa: "agendado" });
  });

  it("un lead con deal completo (cerrado) es 'sin deal abierto': con_calendly abre uno NUEVO", async () => {
    // Un deal cerrado no ocupa el cupo (ADR 0037). Si el lead re-aplica Con Calendly,
    // nace un deal nuevo en Agendado.
    await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "setteo_no_calificado" })], {
      aplicarReglaDeDeals: true,
    });
    const lead = await leadDeCorreo("ana@correo.co");
    const [primero] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    // Lo cerramos directo en la base (no es lo que prueba este test; solo prepara el estado).
    await db.update(deals).set({ etapa: "cierre_perdido" }).where(eq(deals.id, primero.id));

    const r = await ingerirEntradas(db, programId, [entrada({ token: "t1", correo: "ana@correo.co", estado: "con_calendly" })], {
      aplicarReglaDeDeals: true,
    });
    const abiertos = await db.select().from(deals).where(eq(deals.leadId, lead.id));
    expect(abiertos).toHaveLength(2);
    expect(abiertos.some((d) => d.etapa === "agendado")).toBe(true);
    expect(r.reglaDeDeals[0].accion).toEqual({ tipo: "abrir", etapa: "agendado" });
  });
});
