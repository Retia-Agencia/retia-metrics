import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  leadContactos,
  miembrosPrograma,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { inboxDelPrograma } from "@/lib/queries/inbox";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 071: `inboxDelPrograma`, el read model del Inbox. Cada bucket con su caso positivo
 * y su negativo, un deal en un solo bucket, el alcance por dueño vs. equipo, la frontera de
 * programa, los anulados excluidos, el estancamiento por días hábiles, el re-envío que se
 * limpia con una actividad posterior, y las llamadas de hoy (vencida ayer incluida, con
 * resultado excluida).
 *
 * "Hoy" se fija a un LUNES (2026-09-28) para que los cálculos de días hábiles sean estables.
 */

const HOY = "2026-09-28"; // lunes
const AHORA = new Date("2026-09-28T12:00:00-05:00");

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let cohortId: string;
let sourceId: string;
let closer: string;
let otroCloser: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000", diasSinActividad: 3 }).returning();
  programId = p.id;
  const [p2] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "800" }).returning();
  otroProgramId = p2.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-11-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-30",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform", tipo: "google_sheet" }).returning();
  sourceId = s.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru", nombre: "Maru" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jose@retiagrowth.com", rol: "closer", closerId: "Jose", nombre: "Jose" }).returning();
  otroCloser = u2.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

/** Crea un lead con su deal. Devuelve el id del deal (y del lead por si hace falta). */
async function crearDeal(o: {
  etapa: EtapaDeal;
  pendiente?: "reagenda" | "seguimiento" | "proxima_cohorte" | null;
  programa?: string;
  owner?: string | null;
  anulado?: boolean;
  fechaLimitePago?: string | null;
  cohorte?: boolean;
  createdAt?: Date;
  handoffEn?: Date | null;
}): Promise<{ dealId: string; leadId: string }> {
  const prog = o.programa ?? programId;
  const [l] = await db
    .insert(leads)
    .values({ programId: prog, emailNormalizado: `lead${++leadN}@correo.co`, nombre: `Lead ${leadN}` })
    .returning();
  const marca = o.anulado ? { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error de tecleo" } : {};
  const [d] = await db
    .insert(deals)
    .values({
      leadId: l.id,
      programId: prog,
      cohortId: o.cohorte === false ? null : prog === programId ? cohortId : null,
      etapa: o.etapa,
      pendiente: o.pendiente ?? null,
      ownerUserId: o.owner === undefined ? closer : o.owner,
      valorVendidoUsd: prog === programId ? "1000.00" : null,
      fechaLimitePago: o.fechaLimitePago ?? null,
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
      ...(o.handoffEn ? { handoffEn: o.handoffEn } : {}),
      ...marca,
    })
    .returning();
  return { dealId: d.id, leadId: l.id };
}

/** Una llamada agendada con su cita, colgada de un deal (o suelta si `dealId` es null). */
async function crearLlamada(o: {
  dealId: string | null;
  programa?: string;
  fechaAgenda?: Date | null;
  resultado?: (typeof calls.$inferInsert)["resultado"];
  anulada?: boolean;
  createdAt?: Date;
  origen?: string;
  raw?: unknown;
  host?: string | null;
}): Promise<string> {
  const marca = o.anulada ? { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" } : {};
  const [c] = await db
    .insert(calls)
    .values({
      dealId: o.dealId,
      programId: o.programa ?? programId,
      resultado: o.resultado ?? "agendada",
      fechaAgenda: o.fechaAgenda ?? null,
      emailLead: "lead@correo.co",
      origen: o.origen ?? "calendly",
      raw: o.raw,
      calendlyHostEmail: o.host,
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
      ...marca,
    })
    .returning();
  return c.id;
}

/** Instante (medianoche de Bogotá) de un día `YYYY-MM-DD`. */
function enBogota(dia: string): Date {
  return new Date(`${dia}T12:00:00-05:00`);
}

// ───────────────────────────────────────────── sección 1: llamadas de hoy sin resultado

describe("inboxDelPrograma — llamadas de hoy sin resultado", () => {
  it("incluye una agendada vencida de ayer y excluye una con resultado", async () => {
    const { dealId } = await crearDeal({ etapa: "agendado" });
    const vencidaAyer = await crearLlamada({ dealId, fechaAgenda: enBogota("2026-09-25") }); // viernes pasado
    // Misma cita pero ya marcada show: no cuenta (resultado distinto de agendada).
    await crearLlamada({ dealId, fechaAgenda: enBogota("2026-09-25"), resultado: "show" });

    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY, AHORA);
    expect(inbox.llamadasDeHoy.map((f) => f.callId)).toEqual([vencidaAyer]);
  });

  it("incluye la de ayer y excluye una de hoy cuya hora todavía no pasa", async () => {
    const { dealId } = await crearDeal({ etapa: "agendado" });
    const ayer = await crearLlamada({ dealId, fechaAgenda: new Date("2026-09-27T18:00:00-05:00") });
    await crearLlamada({ dealId, fechaAgenda: new Date("2026-09-28T16:00:00-05:00") });

    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY, AHORA);
    expect(inbox.llamadasDeHoy.map((f) => f.callId)).toEqual([ayer]);
  });

  it("solo de MIS deals para un closer; el equipo ve las de todos con el dueño", async () => {
    const mio = await crearDeal({ etapa: "agendado", owner: closer });
    const ajeno = await crearDeal({ etapa: "agendado", owner: otroCloser });
    const callMia = await crearLlamada({ dealId: mio.dealId, fechaAgenda: enBogota(HOY) });
    const callAjena = await crearLlamada({ dealId: ajeno.dealId, fechaAgenda: enBogota(HOY) });

    const soloMias = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY, AHORA);
    expect(soloMias.llamadasDeHoy.map((f) => f.callId)).toEqual([callMia]);

    const equipo = await inboxDelPrograma(db, programId, "equipo", HOY, AHORA);
    expect(new Set(equipo.llamadasDeHoy.map((f) => f.callId))).toEqual(new Set([callMia, callAjena]));
    const laAjena = equipo.llamadasDeHoy.find((f) => f.callId === callAjena)!;
    expect(laAjena.ownerNombre).toBe("Jose");
  });

  it("excluye una llamada anulada y una de un deal cerrado o de otro programa", async () => {
    const { dealId } = await crearDeal({ etapa: "agendado" });
    await crearLlamada({ dealId, fechaAgenda: enBogota(HOY), anulada: true });
    const cerrado = await crearDeal({ etapa: "ganado_completo" });
    await crearLlamada({ dealId: cerrado.dealId, fechaAgenda: enBogota(HOY) });
    const ajeno = await crearDeal({ etapa: "agendado", programa: otroProgramId, owner: closer });
    await crearLlamada({ dealId: ajeno.dealId, programa: otroProgramId, fechaAgenda: enBogota(HOY) });

    const inbox = await inboxDelPrograma(db, programId, "equipo", HOY, AHORA);
    expect(inbox.llamadasDeHoy).toHaveLength(0);
  });
});

// ───────────────────────────────────────────── sección 3: llamadas sueltas

describe("inboxDelPrograma — llamadas sueltas", () => {
  it("lista las vigentes sin deal del programa y excluye las anuladas y las de otro programa", async () => {
    const suelta = await crearLlamada({ dealId: null, fechaAgenda: enBogota(HOY) });
    await crearLlamada({ dealId: null, fechaAgenda: enBogota(HOY), anulada: true });
    await crearLlamada({ dealId: null, programa: otroProgramId, fechaAgenda: enBogota(HOY) });
    // Una con deal NO es suelta.
    const { dealId } = await crearDeal({ etapa: "agendado" });
    await crearLlamada({ dealId, fechaAgenda: enBogota(HOY) });

    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.llamadasSueltas.map((f) => f.callId)).toEqual([suelta]);
  });

  it("las sueltas son de programa, no de dueño: el mismo resultado para closer y equipo", async () => {
    const suelta = await crearLlamada({ dealId: null, fechaAgenda: enBogota(HOY) });
    const comoCloser = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    const comoEquipo = await inboxDelPrograma(db, programId, "equipo", HOY);
    expect(comoCloser.llamadasSueltas.map((f) => f.callId)).toEqual([suelta]);
    expect(comoEquipo.llamadasSueltas.map((f) => f.callId)).toEqual([suelta]);
  });

  it("solo las de Calendly: una de la hoja que la migración no colgó no entra (078; Mani, 30-sep)", async () => {
    const deCalendly = await crearLlamada({ dealId: null, fechaAgenda: enBogota(HOY) });
    await crearLlamada({ dealId: null, fechaAgenda: enBogota(HOY), origen: "sheets" });
    const inbox = await inboxDelPrograma(db, programId, "equipo", HOY);
    expect(inbox.llamadasSueltas.map((f) => f.callId)).toEqual([deCalendly]);
  });

  it("solo el host puede colgar y sugiere por nombre normalizado o teléfono", async () => {
    await db.insert(miembrosPrograma).values({ userId: closer, programId, calendlyEmail: "host@calendly.co" });
    const porNombre = await crearDeal({ etapa: "calificado" });
    await db.update(leads).set({ nombre: "Ána   Pérez" }).where(eq(leads.id, porNombre.leadId));
    const porTelefono = await crearDeal({ etapa: "calificado" });
    await db.insert(leadContactos).values({ leadId: porTelefono.leadId, programId, tipo: "telefono", valor: "573001234567" });
    const callId = await crearLlamada({
      dealId: null,
      host: "HOST@calendly.co",
      raw: { nombre: " ana perez ", telefono: "+57 (300) 123-4567" },
    });

    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY, AHORA, { userId: closer, rol: "closer" });
    const fila = inbox.llamadasSueltas.find((f) => f.callId === callId)!;
    expect(fila.puedeColgar).toBe(true);
    expect(new Set(fila.sugerencias?.map((d) => d.dealId))).toEqual(new Set([porNombre.dealId, porTelefono.dealId]));

    const ajeno = await inboxDelPrograma(db, programId, { ownerUserId: otroCloser }, HOY, AHORA, { userId: otroCloser, rol: "closer" });
    expect(ajeno.llamadasSueltas.find((f) => f.callId === callId)?.puedeColgar).toBe(false);
  });
});

describe("inboxDelPrograma — atención: link enviado sin cita", () => {
  it("el lunes alerta un link del viernes y una cita vigente lo limpia", async () => {
    const { dealId } = await crearDeal({ etapa: "calificado", handoffEn: new Date("2026-09-25T15:00:00Z") });
    let inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY, AHORA);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).toBe("link_sin_cita");

    await crearLlamada({ dealId, fechaAgenda: enBogota("2026-10-01") });
    inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY, AHORA);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("link_sin_cita");
  });
});

// ───────────────────────────────────────────── sección 4: lo mío que necesita atención

/** Los motivos por dealId, para afirmar en qué bucket cayó cada deal. */
async function motivosPorDeal(alcance: Parameters<typeof inboxDelPrograma>[2]) {
  const inbox = await inboxDelPrograma(db, programId, alcance, HOY);
  return new Map(inbox.atencion.map((f) => [f.dealId, f.motivo]));
}

describe("inboxDelPrograma — atención: agotó intentos", () => {
  it("con dos intentos no entra; con tres muestra el conteo", async () => {
    const { dealId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-27") });
    await db.insert(dealActividades).values([
      { dealId, tipo: "intento", fecha: enBogota("2026-09-27") },
      { dealId, tipo: "intento", fecha: enBogota("2026-09-27") },
    ]);
    let inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((fila) => fila.dealId === dealId)).toBeUndefined();

    await db.insert(dealActividades).values({ dealId, tipo: "intento", fecha: enBogota("2026-09-27") });
    inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((fila) => fila.dealId === dealId)).toMatchObject({
      motivo: "intentos_agotados",
      intentos: 3,
    });
  });

  it("desaparece después de entrar a otra etapa", async () => {
    const { dealId } = await crearDeal({ etapa: "en_gestion", createdAt: enBogota("2026-09-26") });
    await db.insert(dealActividades).values([
      { dealId, tipo: "intento", fecha: enBogota("2026-09-27") },
      { dealId, tipo: "intento", fecha: enBogota("2026-09-27") },
      { dealId, tipo: "intento", fecha: enBogota("2026-09-27") },
    ]);
    await db.update(deals).set({ etapa: "contactado" }).where(eq(deals.id, dealId));
    await db.insert(dealEtapaHistorial).values({
      dealId,
      de: "en_gestion",
      a: "contactado",
      fecha: AHORA,
    });

    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((fila) => fila.dealId === dealId)).toBeUndefined();
  });
});

describe("inboxDelPrograma — atención: re-agenda sin nueva fecha (a)", () => {
  it("positivo: Re-agenda pendiente sin cita futura entra", async () => {
    const { dealId } = await crearDeal({ etapa: "agendado", pendiente: "reagenda" });
    const m = await motivosPorDeal({ ownerUserId: closer });
    expect(m.get(dealId)).toBe("reagenda_sin_fecha");
  });

  it("negativo: Re-agenda pendiente CON cita futura no entra por (a)", async () => {
    const { dealId } = await crearDeal({ etapa: "agendado", pendiente: "reagenda" });
    await crearLlamada({ dealId, fechaAgenda: enBogota("2026-09-30") }); // futura
    const m = await motivosPorDeal({ ownerUserId: closer });
    expect(m.get(dealId)).not.toBe("reagenda_sin_fecha");
  });
});

describe("inboxDelPrograma — atención: compromiso verbal vencido (b)", () => {
  it("positivo: compromiso_verbal con fecha límite pasada entra", async () => {
    const { dealId } = await crearDeal({ etapa: "compromiso_verbal", fechaLimitePago: "2026-09-20" });
    const m = await motivosPorDeal({ ownerUserId: closer });
    expect(m.get(dealId)).toBe("compromiso_vencido");
  });

  it("negativo: compromiso_verbal con fecha límite hoy o futura no entra", async () => {
    const { dealId } = await crearDeal({ etapa: "compromiso_verbal", fechaLimitePago: HOY });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("compromiso_vencido");
  });
});

describe("inboxDelPrograma — atención: pago vencido con saldo (c)", () => {
  it("positivo: abonado con fecha límite pasada y saldo entra con su saldo", async () => {
    const { dealId } = await crearDeal({ etapa: "ganado_parcial", fechaLimitePago: "2026-09-20" });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-19", monto: "400", moneda: "USD", comprobanteUrl: "https://soporte.test/400" });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    const fila = inbox.atencion.find((f) => f.dealId === dealId)!;
    expect(fila.motivo).toBe("pago_vencido");
    expect(fila.saldo).toBe(600); // 1000 - 400
    expect(fila.fecha).toBe("2026-09-20");
  });

  it("negativo: abonado pagado completo (saldo 0) no entra", async () => {
    const { dealId } = await crearDeal({ etapa: "ganado_parcial", fechaLimitePago: "2026-09-20" });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-19", monto: "1000", moneda: "USD", comprobanteUrl: "https://soporte.test/1000" });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("pago_vencido");
  });
});

describe("inboxDelPrograma — atención: abono sin comprobante", () => {
  it("aparece antes que los otros motivos y un abono anulado no cuenta", async () => {
    const { dealId } = await crearDeal({ etapa: "ganado_parcial", fechaLimitePago: "2026-09-20" });
    const [abono] = await db.insert(abonos).values({
      dealId,
      programId,
      fecha: "2026-09-19",
      monto: "400",
      moneda: "USD",
    }).returning();
    expect((await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY)).atencion.find((f) => f.dealId === dealId)?.motivo)
      .toBe("abono_sin_comprobante");

    await db.update(abonos).set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "Duplicado" }).where(eq(abonos.id, abono.id));
    expect((await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY)).atencion.find((f) => f.dealId === dealId)?.motivo)
      .not.toBe("abono_sin_comprobante");
  });
});

describe("inboxDelPrograma — atención: re-envío sin atender (d)", () => {
  it("positivo: un envío completo posterior a la última actividad del deal entra", async () => {
    // Deal creado hace tiempo, con actividad vieja.
    const { dealId, leadId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-01") });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", userId: closer, fecha: enBogota("2026-09-10") });
    // Re-envío COMPLETO más nuevo que la actividad.
    await db.insert(submissions).values({ leadId, sourceId, token: "t1", esParcial: false, fechaEnvio: enBogota("2026-09-24") });
    const m = await motivosPorDeal({ ownerUserId: closer });
    expect(m.get(dealId)).toBe("reenvio_sin_atender");
  });

  it("negativo: se limpia cuando se registra una actividad DESPUÉS del re-envío", async () => {
    const { dealId, leadId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-01") });
    await db.insert(submissions).values({ leadId, sourceId, token: "t1", esParcial: false, fechaEnvio: enBogota("2026-09-24") });
    // Actividad posterior al re-envío: ya lo atendió.
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", userId: closer, fecha: enBogota("2026-09-26") });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("reenvio_sin_atender");
  });

  it("un envío PARCIAL no dispara el re-envío", async () => {
    const { dealId, leadId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-01") });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", userId: closer, fecha: enBogota("2026-09-10") });
    await db.insert(submissions).values({ leadId, sourceId, token: "t1", esParcial: true, fechaEnvio: enBogota("2026-09-24") });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("reenvio_sin_atender");
  });
});

describe("inboxDelPrograma — atención: estancado (e), en días hábiles", () => {
  it("positivo: sin actividad hace más de 3 días hábiles entra como estancado", async () => {
    // Última actividad el lunes anterior (2026-09-21); a hoy (lunes 28) van 5 hábiles sin actividad.
    const { dealId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-21") });
    const m = await motivosPorDeal({ ownerUserId: closer });
    expect(m.get(dealId)).toBe("estancado");
  });

  it("negativo: actividad reciente (ayer hábil) no está estancado", async () => {
    // El deal se creó viejo pero tuvo actividad el viernes (2026-09-25): 1 día hábil sin actividad.
    const { dealId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-01") });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", userId: closer, fecha: enBogota("2026-09-25") });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("estancado");
  });

  it("el fin de semana no cuenta: de viernes a lunes es 1 día hábil (con umbral 1)", async () => {
    // Umbral del programa en 1 día hábil para aislar el conteo viernes→lunes.
    await db.update(programs).set({ diasSinActividad: 1 }).where(eq(programs.id, programId));
    // Actividad el viernes 25; hoy lunes 28 -> 1 día hábil sin actividad -> estancado con umbral 1.
    const { dealId } = await crearDeal({ etapa: "contactado", createdAt: enBogota("2026-09-01") });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", userId: closer, fecha: enBogota("2026-09-25") });
    const m = await motivosPorDeal({ ownerUserId: closer });
    expect(m.get(dealId)).toBe("estancado");
  });

  it("un abono o un movimiento de etapa cuentan como actividad y sacan del estancamiento", async () => {
    const { dealId } = await crearDeal({ etapa: "ganado_parcial", createdAt: enBogota("2026-09-01"), fechaLimitePago: null });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-25", monto: "100", moneda: "USD" });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(inbox.atencion.find((f) => f.dealId === dealId)?.motivo).not.toBe("estancado");
  });
});

describe("inboxDelPrograma — atención: un deal en UN solo bucket, y alcance/frontera", () => {
  it("un deal que cumple varios buckets aparece una vez, en el primero (re-agenda gana)", async () => {
    // Re-agenda pendiente sin cita futura (a) y sin actividad hace mucho (e): debe ser (a).
    const { dealId } = await crearDeal({ etapa: "agendado", pendiente: "reagenda", createdAt: enBogota("2026-09-01") });
    const inbox = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    const suyas = inbox.atencion.filter((f) => f.dealId === dealId);
    expect(suyas).toHaveLength(1);
    expect(suyas[0].motivo).toBe("reagenda_sin_fecha");
  });

  it("los deals de otro closer no salen para un closer, pero sí para el equipo", async () => {
    const ajeno = await crearDeal({ etapa: "agendado", pendiente: "reagenda", owner: otroCloser, createdAt: enBogota("2026-09-01") });

    const comoCloser = await inboxDelPrograma(db, programId, { ownerUserId: closer }, HOY);
    expect(comoCloser.atencion.find((f) => f.dealId === ajeno.dealId)).toBeUndefined();

    const comoEquipo = await inboxDelPrograma(db, programId, "equipo", HOY);
    const fila = comoEquipo.atencion.find((f) => f.dealId === ajeno.dealId)!;
    expect(fila.motivo).toBe("reagenda_sin_fecha");
    expect(fila.ownerNombre).toBe("Jose");
  });

  it("un deal de otro programa nunca aparece", async () => {
    const ajeno = await crearDeal({ etapa: "agendado", pendiente: "reagenda", programa: otroProgramId, owner: closer, createdAt: enBogota("2026-09-01") });
    const inbox = await inboxDelPrograma(db, programId, "equipo", HOY);
    expect(inbox.atencion.find((f) => f.dealId === ajeno.dealId)).toBeUndefined();
  });

  it("un deal anulado nunca aparece, ni cerrado", async () => {
    await crearDeal({ etapa: "agendado", pendiente: "reagenda", anulado: true, createdAt: enBogota("2026-09-01") });
    await crearDeal({ etapa: "ganado_completo", createdAt: enBogota("2026-09-01") });
    await crearDeal({ etapa: "cierre_perdido", createdAt: enBogota("2026-09-01") });
    const inbox = await inboxDelPrograma(db, programId, "equipo", HOY);
    expect(inbox.atencion).toHaveLength(0);
  });
});
