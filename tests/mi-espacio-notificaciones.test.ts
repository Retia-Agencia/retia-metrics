import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  leadContactos,
  leads,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { registrarNovedadCalendly } from "@/lib/notificaciones-calendly/notificaciones";
import {
  CHIPS_NOTIFICACIONES,
  chipPedido,
  conteosDeChips,
  notificacionesDeChip,
  type ChipNotificacion,
} from "@/lib/mi-espacio/notificaciones";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 222: las Notificaciones de Mi espacio por tipo. Prueba que cada chip devuelve SÓLO
 * sus deals y que su conteo coincide con la longitud de todas las páginas concatenadas; que
 * un deal de otro programa o de otro dueño nunca aparece (ids forjados); la paginación de
 * 24; y que un `?chip=` inválido cae a `hoy`.
 */

const HOY = "2026-10-20";
const AYER = "2026-10-19";
const MANANA = "2026-10-21";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let cohortId: string;
let yo: string;
let otro: string;
let sourceId: string;
let otroSourceId: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [p2] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p2", nombre: "P2", ticketUsd: "1000" })
    .returning();
  otroProgramId = p2.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = s.id;
  const [s2] = await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform" }).returning();
  otroSourceId = s2.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-11-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-11-14",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [u1] = await db.insert(users).values({ email: "yo@retia.co", rol: "closer", closerId: "yo", nombre: "Yo" }).returning();
  const [u2] = await db.insert(users).values({ email: "otro@retia.co", rol: "closer", closerId: "otro", nombre: "Otro" }).returning();
  yo = u1.id;
  otro = u2.id;
});

afterEach(async () => {
  await cerrar();
});

interface OpcDeal {
  etapa: EtapaDeal;
  pendiente?: PendienteDeal | null;
  owner?: string;
  programa?: string;
  source?: string;
  fechaSeguimiento?: string | null;
  fechaLimitePago?: string | null;
  /** Instante del último envío (leads.fechaUltimaAplicacion), para "duplicados de hoy". */
  ultimaAplicacion?: string | null;
  /** Un contacto correo sin confirmar hace al lead "posible duplicado". */
  duplicado?: boolean;
  nuevo?: boolean;
  creado?: string;
}

async function deal(o: OpcDeal): Promise<{ dealId: string; leadId: string }> {
  const prog = o.programa ?? programId;
  const src = o.source ?? (prog === programId ? sourceId : otroSourceId);
  const [l] = await db
    .insert(leads)
    .values({
      programId: prog,
      emailNormalizado: `l${++leadN}@correo.co`,
      nombre: `Lead ${leadN}`,
      numAplicaciones: 1,
      ...(o.ultimaAplicacion ? { fechaUltimaAplicacion: new Date(o.ultimaAplicacion) } : {}),
    })
    .returning();
  const [env] = await db
    .insert(submissions)
    .values({ leadId: l.id, sourceId: src, token: `t${leadN}`, utmSource: "meta", utmMedium: "cpc" })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({
      leadId: l.id,
      submissionOrigenId: env.id,
      programId: prog,
      cohortId: prog === programId ? cohortId : null,
      etapa: o.etapa,
      pendiente: o.pendiente ?? null,
      ownerUserId: o.owner ?? yo,
      ownerNovedadEn: o.nuevo ? new Date("2026-10-20T12:00:00Z") : null,
      valorVendidoUsd: "1000.00",
      fechaSeguimiento: o.fechaSeguimiento ?? null,
      fechaLimitePago: o.fechaLimitePago ?? null,
      ...(o.creado ? { createdAt: new Date(o.creado) } : {}),
    })
    .returning();
  const fecha = new Date(`${o.creado ? o.creado.slice(0, 10) : HOY}T12:00:00-05:00`);
  await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: null, a: o.etapa, fecha });
  if (o.duplicado) {
    await db.insert(leadContactos).values({
      leadId: l.id,
      programId: prog,
      tipo: "correo",
      valor: `dup${leadN}@correo.co`,
      confirmado: false,
    });
  }
  return { dealId: d.id, leadId: l.id };
}

/** Una llamada vigente (o anulada) colgada de un deal, con su día de Bogotá. */
async function llamada(dealId: string, dia: string, prog = programId, anulada = false): Promise<string> {
  const [c] = await db
    .insert(calls)
    .values({
      dealId,
      programId: prog,
      fechaLlamada: new Date(`${dia}T12:00:00-05:00`),
      resultado: "show",
      ...(anulada ? { anuladoEn: new Date(), anuladoPor: yo, motivoAnulacion: "error" } : {}),
    })
    .returning();
  return c.id;
}

async function dealId(o: OpcDeal): Promise<string> {
  return (await deal(o)).dealId;
}

/** Todas las tarjetas de un chip, concatenando TODAS las páginas. */
async function todas(chip: ChipNotificacion, userId = yo): Promise<string[]> {
  const ids: string[] = [];
  for (let pagina = 0; ; pagina++) {
    const r = await notificacionesDeChip(db, { programId, userId, chip, pagina }, HOY);
    ids.push(...r.tarjetas.map((t) => t.dealId));
    if ((pagina + 1) * 24 >= r.total) break;
  }
  return ids;
}

describe("notificaciones de Mi espacio (222)", () => {
  it("un ?chip inválido cae a hoy", () => {
    expect(chipPedido(undefined)).toBe("hoy");
    expect(chipPedido("")).toBe("hoy");
    expect(chipPedido("inexistente")).toBe("hoy");
    expect(chipPedido("reagenda")).toBe("reagenda");
  });

  it("hoy: llamada de hoy o pendiente de reagenda/seguimiento con fecha de hoy", async () => {
    const conLlamadaHoy = await deal({ etapa: "atendido" });
    await llamada(conLlamadaHoy.dealId, HOY);
    const conLlamadaAyer = await deal({ etapa: "atendido" });
    await llamada(conLlamadaAyer.dealId, AYER);
    const reagendaHoy = await dealId({ etapa: "contactado", pendiente: "reagenda", fechaSeguimiento: HOY });
    const seguimientoHoy = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY });
    const seguimientoManana = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: MANANA });

    const ids = await todas("hoy");
    expect(new Set(ids)).toEqual(new Set([conLlamadaHoy.dealId, reagendaHoy, seguimientoHoy]));
    expect(ids).not.toContain(conLlamadaAyer.dealId);
    expect(ids).not.toContain(seguimientoManana);
  });

  it("una llamada ANULADA no cuenta para hoy", async () => {
    const d = await deal({ etapa: "atendido" });
    await llamada(d.dealId, HOY, programId, true);
    expect(await todas("hoy")).not.toContain(d.dealId);
  });

  it("reagenda / seguimiento / proxima_cohorte: cada chip su pendiente", async () => {
    const r = await dealId({ etapa: "contactado", pendiente: "reagenda", fechaSeguimiento: MANANA });
    const s = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: MANANA });
    const pc = await dealId({ etapa: "atendido", pendiente: "proxima_cohorte" });
    await dealId({ etapa: "potencial" });

    expect(await todas("reagenda")).toEqual([r]);
    expect(await todas("seguimiento")).toEqual([s]);
    expect(await todas("proxima_cohorte")).toEqual([pc]);
  });

  it("vencidos: seguimiento vencido o compromiso/cartera vencidos (avisos de la tarjeta)", async () => {
    const segVencido = await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: AYER });
    const compromisoVencido = await dealId({ etapa: "compromiso_verbal", fechaLimitePago: AYER });
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: MANANA });

    const ids = await todas("vencidos");
    expect(new Set(ids)).toEqual(new Set([segVencido, compromisoVencido]));
  });

  it("nuevos: solo los que el dueño no ha abierto", async () => {
    const nuevo = await dealId({ etapa: "registrado", nuevo: true });
    await dealId({ etapa: "registrado", nuevo: false });
    expect(await todas("nuevos")).toEqual([nuevo]);
  });

  it("duplicados: solo los del dueño cuyo último envío es HOY", async () => {
    const dupHoy = await dealId({ etapa: "contactado", duplicado: true, ultimaAplicacion: `${HOY}T09:00:00-05:00` });
    await dealId({ etapa: "contactado", duplicado: true, ultimaAplicacion: `${AYER}T09:00:00-05:00` });
    await dealId({ etapa: "contactado", duplicado: false, ultimaAplicacion: `${HOY}T09:00:00-05:00` });

    expect(await todas("duplicados")).toEqual([dupHoy]);
  });

  it("calendly: deals con novedad del usuario+programa, leídas o no", async () => {
    const conNovedad = await deal({ etapa: "agendado" });
    const callId = await llamada(conNovedad.dealId, HOY);
    const ok = await registrarNovedadCalendly(db, {
      programId,
      dealId: conNovedad.dealId,
      callId,
      tipo: "cita_nueva",
      claveEvento: "ev-1",
    });
    expect(ok).toBe(true);
    await deal({ etapa: "agendado" });

    expect(await todas("calendly")).toEqual([conNovedad.dealId]);
  });

  it("cada conteo coincide con la longitud de la lista completa", async () => {
    // Un surtido que cae en varios chips.
    const d1 = await deal({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY });
    await llamada(d1.dealId, HOY);
    await dealId({ etapa: "contactado", pendiente: "reagenda", fechaSeguimiento: AYER });
    await dealId({ etapa: "atendido", pendiente: "proxima_cohorte" });
    await dealId({ etapa: "registrado", nuevo: true });

    const conteos = await conteosDeChips(db, { programId, userId: yo }, HOY);
    for (const chip of CHIPS_NOTIFICACIONES) {
      const lista = await todas(chip);
      expect(lista.length, chip).toBe(conteos[chip]);
    }
  });

  it("un deal de otro programa o de otro dueño nunca aparece (ids forjados)", async () => {
    // Deals que caerían en varios chips, pero de otro dueño o programa.
    const otroDuenoLlamada = await deal({ etapa: "atendido", owner: otro });
    await llamada(otroDuenoLlamada.dealId, HOY);
    const otroProgLlamada = await deal({ etapa: "atendido", programa: otroProgramId });
    await llamada(otroProgLlamada.dealId, HOY, otroProgramId);
    await dealId({ etapa: "atendido", pendiente: "seguimiento", fechaSeguimiento: HOY, owner: otro });
    await dealId({ etapa: "registrado", nuevo: true, owner: otro });
    await dealId({ etapa: "compromiso_verbal", fechaLimitePago: AYER, programa: otroProgramId });

    for (const chip of CHIPS_NOTIFICACIONES) {
      // Mi universo (yo + programId) no tiene ninguno de esos deals.
      const mios = await todas(chip, yo);
      expect(mios, chip).not.toContain(otroDuenoLlamada.dealId);
      expect(mios, chip).not.toContain(otroProgLlamada.dealId);
    }
    // Forjar el userId del otro dueño sí ve lo suyo, nunca lo mío: la frontera es el universo.
    const d1 = await deal({ etapa: "atendido", owner: yo });
    await llamada(d1.dealId, HOY);
    const forjado = await notificacionesDeChip(db, { programId, userId: otro, chip: "hoy" }, HOY);
    expect(forjado.tarjetas.map((t) => t.dealId)).not.toContain(d1.dealId);
    expect(forjado.tarjetas.map((t) => t.dealId)).toContain(otroDuenoLlamada.dealId);
  });

  it("pagina de a 24 en el servidor", async () => {
    for (let i = 0; i < 30; i++) {
      await dealId({ etapa: "atendido", pendiente: "proxima_cohorte", creado: `2026-10-${String(i + 1).padStart(2, "0")}T08:00:00-05:00` });
    }
    const p0 = await notificacionesDeChip(db, { programId, userId: yo, chip: "proxima_cohorte", pagina: 0 }, HOY);
    const p1 = await notificacionesDeChip(db, { programId, userId: yo, chip: "proxima_cohorte", pagina: 1 }, HOY);
    expect(p0.total).toBe(30);
    expect(p0.tarjetas).toHaveLength(24);
    expect(p1.tarjetas).toHaveLength(6);
    // Sin solapamiento y la unión es todo.
    const union = new Set([...p0.tarjetas, ...p1.tarjetas].map((t) => t.dealId));
    expect(union.size).toBe(30);
  });
});
