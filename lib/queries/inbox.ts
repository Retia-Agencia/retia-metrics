import { and, eq, inArray, isNotNull, isNull, lte, notInArray, or } from "drizzle-orm";
import {
  calls,
  deals,
  leadContactos,
  leads,
  programs,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { aceptaAbono, type EtapaDeal } from "@/lib/deals/etapas";
import { diaDeCalendario, diasHabilesEntre } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import { carteraVencida } from "@/lib/queries/cartera";
import { vigente } from "@/lib/queries/vigente";
import { ultimaActividadPorDeal } from "@/lib/queries/ultima-actividad";
import { ORIGEN_DE_SUELTA_ASIGNABLE, sueltaPorAsignar } from "@/lib/calendly/suelta";
import { puedeColgarSuelta } from "@/lib/calendly/suelta";
import { closerHost, type CloserDelPrograma } from "@/lib/calendly/emparejar-llamada";
import { closersConCalendly } from "@/lib/calendly/colgar-llamada";
import type { Rol } from "@/lib/auth/roles";
import { normalizarTelefono } from "@/lib/ingesta/envio";
import { linkEnviadoSinCita } from "@/lib/deals/handoff";
import type { OrigenDeFila } from "@/lib/queries/inbox-sin-dueno";
import { dealsConAbonoSinComprobante } from "@/lib/deals/abono-sin-comprobante";
import { INTENTOS_PARA_ALERTA, intentosEnEtapaPorDeal } from "@/lib/queries/intentos";
import { proximoContactoVencido } from "@/lib/deals/proximo-contacto";
import {
  ETAPAS_CERRADAS,
  llamadaPasadaSinResultado,
} from "@/lib/queries/metricas-filtros";

/**
 * El READ MODEL del Inbox (ticket 071, ADR 0050): lo que un closer tiene que hacer HOY,
 * sin filtrar nada. Reemplaza a `/mi-dia`. UNA sola función, `inboxDelPrograma`, que arma
 * cada sección con consultas simples unidas en memoria.
 *
 * Las secciones "sin dueño" (Por settear y Agendados sin dueño) NO están aquí: viven
 * en `lib/queries/inbox-sin-dueno.ts` (ticket 070) y la pantalla las intercala. Aquí van:
 *
 *  1. **Llamadas que ya pasaron sin resultado** — el dolor número uno (reunión con closers,
 *     24-sep): llamadas VIGENTES de MIS deals cuyo instante de cita ya pasó y
 *     cuyo `resultado` sigue en `agendada`. Es la red de seguridad para ponerse al día al
 *     final de un bloque de llamadas.
 *  3. **Llamadas sueltas** del programa (ADR 0049, decisión K2): llamadas vigentes de
 *     Calendly con `deal_id` nulo (`sueltaPorAsignar`), que un closer asigna a un deal desde
 *     aquí. Las de la hoja que la migración no pudo colgar no entran: son rareza (078).
 *  4. **Lo mío que necesita atención**: MIS deals vigentes, cada uno en UN solo bucket,
 *     el primero que casa en este orden: abono sin comprobante, re-agenda sin fecha,
 *     compromiso vencido, fecha límite vencida con saldo, re-envío sin atender,
 *     intentos agotados, link sin cita, estancado.
 *
 * ## Alcance: `mío` vs `equipo`
 * Un closer ve SUS deals (dueño = él). Quien administra (`esAdministrador`, la pantalla lo
 * decide) ve todo el equipo y cada fila lleva el nombre de su dueño. Se pasa como
 * `alcance`: `{ ownerUserId }` estrecha a un dueño, `"equipo"` no estrecha. **El programa
 * es frontera** (ADR 0043): todo es del programa que entra por parámetro, jamás cruza.
 *
 * ## Reglas duras respetadas
 * - **Solo lo vigente**: cada lectura de `calls`, `deals` o `abonos` pasa por `vigente(...)`
 *   explícito (ADR 0026). Un registro anulado no cuenta en ninguna sección.
 * - **Nada de subconsultas correlacionadas** en plantillas `sql` ni un `Date` interpolado
 *   (AGENTS.md): cada sección es una consulta con joins normales; la "última actividad" se
 *   arma juntando cinco consultas por lote en memoria, y toda comparación de fechas de
 *   negocio se hace sobre el día de calendario de Bogotá, no metiendo un `Date` en `sql`.
 * - **La plata sale de un módulo** (ADR 0024): el saldo vencido lo da `carteraVencida`
 *   (`lib/queries/cartera.ts` → `saldosDeDeals`), nunca un `sum(abonos)` a mano.
 * - **Días hábiles, festivos incluidos** (regla de Retia): el estancamiento se mide con
 *   `diasHabilesEntre`, que solo excluye sábados y domingos.
 */

/** Las etapas cerradas: nunca aparecen en "lo mío" ni cuentan como abiertas. */
const CERRADAS = ETAPAS_CERRADAS;

/** El motivo por el que un deal cayó en "lo mío que necesita atención". */
export type MotivoAtencion =
  | "reagenda_sin_fecha"
  | "compromiso_vencido"
  | "pago_vencido"
  | "abono_sin_comprobante"
  | "reenvio_sin_atender"
  | "intentos_agotados"
  | "link_sin_cita"
  | "proximo_contacto_vencido"
  | "estancado";

export interface SugerenciaDeSuelta {
  dealId: string;
  leadNombre: string | null;
  leadEmail: string;
}

/** Una llamada de hoy sin resultado (sección 1) o suelta (sección 3): comparten forma. */
export interface FilaLlamada {
  callId: string;
  dealId: string | null;
  leadNombre: string | null;
  leadEmail: string | null;
  /** El día/hora de la cita (instante). `null` si la llamada no tiene fecha de cita. */
  fechaAgenda: Date | null;
  linkCalendly: string | null;
  /** El dueño del deal de la llamada, para "equipo" (nulo en las sueltas y en "mío"). */
  ownerNombre: string | null;
  puedeColgar?: boolean;
  sugerencias?: SugerenciaDeSuelta[];
}

export interface FilaLlamadaSinCloser {
  callId: string;
  dealId: string | null;
  leadNombre: string | null;
  leadEmail: string | null;
  fechaAgenda: Date | null;
  hostEmail: string;
}

/** Una fila de "lo mío que necesita atención" (sección 4). */
export interface FilaAtencion {
  dealId: string;
  areaDeclaradaId: string | null;
  leadNombre: string | null;
  leadEmail: string;
  etapa: EtapaDeal;
  aceptaAbono: boolean;
  motivo: MotivoAtencion;
  /** El dueño del deal, para "equipo" (nulo cuando el alcance es de un dueño). */
  ownerNombre: string | null;
  /** El saldo vencido, solo en `pago_vencido` (misma cifra de `carteraVencida`). */
  saldo: number | null;
  moneda: string | null;
  /** La fecha relevante (`YYYY-MM-DD`): límite de pago en `pago_vencido` y `compromiso_vencido`. */
  fecha: string | null;
  /** Días hábiles sin actividad, solo en `estancado`. */
  diasSinActividad: number | null;
  /** Intentos sin respuesta en la etapa actual, solo en `intentos_agotados`. */
  intentos: number | null;
}

export interface Inbox {
  /** Sección 1: llamadas que ya pasaron sin resultado, la más vieja primero. */
  llamadasDeHoy: FilaLlamada[];
  /** Sección 3: llamadas sueltas del programa, la más vieja primero. */
  llamadasSueltas: FilaLlamada[];
  /** Citas de Calendly cuya host no tiene cuenta vinculada en el programa. */
  llamadasSinCloser: FilaLlamadaSinCloser[];
  /** Sección 4: lo mío que necesita atención, agrupado por motivo (en orden de bucket). */
  atencion: FilaAtencion[];
}

/** El alcance del Inbox: un dueño (el closer) o todo el equipo (quien administra). */
export type AlcanceInbox = { ownerUserId: string } | "equipo";

/**
 * ponytail: el techo es un solo valor para todos los programas. Si uno necesita otro,
 * el camino de mejora es una columna en `programs` con su migracion.
 */
export const MINUTOS_PERDIDO_EN_CALENDLY = 5;

export interface FilaPerdidoEnCalendly {
  dealId: string;
  leadNombre: string | null;
  leadEmail: string;
  /** Instante del envio parcial que abrio el deal. */
  desde: Date;
  /** Minutos completos transcurridos desde el envio parcial. */
  minutos: number;
  origen: OrigenDeFila;
}

/**
 * Deals Calificados sin dueno cuyo parcial de Calendly nunca tuvo su envio completo.
 * Es una lista de equipo: no recibe ni aplica el alcance del Inbox.
 */
export async function perdidosEnCalendly(
  db: Db,
  programId: string,
  ahora: Date = new Date(),
): Promise<FilaPerdidoEnCalendly[]> {
  const limite = new Date(ahora.getTime() - MINUTOS_PERDIDO_EN_CALENDLY * 60_000);
  const candidatos = await db
    .select({
      dealId: deals.id,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      sourceId: submissions.sourceId,
      token: submissions.token,
      fechaEnvio: submissions.fechaEnvio,
      createdAt: submissions.createdAt,
      utmSource: submissions.utmSource,
      utmMedium: submissions.utmMedium,
      utmCampaign: submissions.utmCampaign,
    })
    .from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .innerJoin(submissions, eq(deals.submissionOrigenId, submissions.id))
    .where(
      and(
        eq(deals.programId, programId),
        vigente(deals),
        isNull(deals.ownerUserId),
        eq(deals.etapa, "calificado"),
        eq(submissions.esParcial, true),
        or(
          lte(submissions.fechaEnvio, limite),
          and(isNull(submissions.fechaEnvio), lte(submissions.createdAt, limite)),
        ),
      ),
    );

  if (candidatos.length === 0) return [];

  const pares = new Map(
    candidatos.map((fila) => [`${fila.sourceId}\u0000${fila.token}`, { sourceId: fila.sourceId, token: fila.token }]),
  );
  const completos = await db
    .select({ sourceId: submissions.sourceId, token: submissions.token })
    .from(submissions)
    .where(
      and(
        eq(submissions.esParcial, false),
        or(...[...pares.values()].map((par) => and(eq(submissions.sourceId, par.sourceId), eq(submissions.token, par.token)))),
      ),
    );
  const paresCompletos = new Set(completos.map((fila) => `${fila.sourceId}\u0000${fila.token}`));

  return candidatos
    .filter((fila) => !paresCompletos.has(`${fila.sourceId}\u0000${fila.token}`))
    .map((fila) => {
      const desde = fila.fechaEnvio ?? fila.createdAt;
      return {
        dealId: fila.dealId,
        leadNombre: fila.leadNombre,
        leadEmail: fila.leadEmail,
        desde,
        minutos: Math.floor((ahora.getTime() - desde.getTime()) / 60_000),
        origen: {
          utmSource: fila.utmSource,
          utmMedium: fila.utmMedium,
          utmCampaign: fila.utmCampaign,
          traidoPorNombre: null,
        },
      };
    })
    .sort((a, b) => a.desde.getTime() - b.desde.getTime());
}

export async function inboxDelPrograma(
  db: Db,
  programId: string,
  alcance: AlcanceInbox,
  hoy: string = hoyEnBogota(),
  ahora: Date = new Date(),
  actor?: { userId: string; rol: Rol },
): Promise<Inbox> {
  // Cuántos días hábiles sin actividad marcan "estancado" (por programa, ADR 0012).
  const [programa] = await db
    .select({ diasSinActividad: programs.diasSinActividad })
    .from(programs)
    .where(eq(programs.id, programId));
  const diasEstancado = programa?.diasSinActividad ?? 3;

  const [llamadasDeHoy, llamadasSueltas, llamadasSinCloser, atencion] = await Promise.all([
    seccionLlamadasDeHoy(db, programId, alcance, ahora),
    llamadasSueltasDelPrograma(db, programId, actor),
    llamadasSinCloserDelPrograma(db, programId),
    seccionAtencion(db, programId, alcance, hoy, diasEstancado),
  ]);

  return { llamadasDeHoy, llamadasSueltas, llamadasSinCloser, atencion };
}

// ───────────────────────────────────────────── sección 1: llamadas que ya pasaron sin resultado

/**
 * Llamadas VIGENTES en `agendada` cuyo instante de cita ya pasó, de deals abiertos y
 * vigentes del alcance. El instante entra al predicado compartido como parámetro Drizzle.
 */
async function seccionLlamadasDeHoy(
  db: Db,
  programId: string,
  alcance: AlcanceInbox,
  ahora: Date,
): Promise<FilaLlamada[]> {
  const filas = await db
    .select({
      callId: calls.id,
      dealId: deals.id,
      fechaAgenda: calls.fechaAgenda,
      linkCalendly: calls.linkCalendly,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      ownerUserId: deals.ownerUserId,
      ownerNombre: users.nombre,
      ownerEmail: users.email,
    })
    .from(calls)
    .innerJoin(deals, eq(deals.id, calls.dealId))
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        eq(calls.programId, programId),
        llamadaPasadaSinResultado(ahora),
        vigente(calls),
        vigente(deals),
        alcanceDeDeal(alcance),
      ),
    );

  // La más vieja primero: es la que más urge ponerse al día.
  filas.sort((a, b) => (a.fechaAgenda?.getTime() ?? 0) - (b.fechaAgenda?.getTime() ?? 0));
  return filas.map((f) => ({
    callId: f.callId,
    dealId: f.dealId,
    leadNombre: f.leadNombre,
    leadEmail: f.leadEmail,
    fechaAgenda: f.fechaAgenda,
    linkCalendly: f.linkCalendly,
    ownerNombre: alcance === "equipo" ? (f.ownerNombre ?? f.ownerEmail ?? null) : null,
  }));
}

/** Citas vigentes cuya host no casa con una cuenta del equipo. Son del programa entero. */
export async function llamadasSinCloserDelPrograma(
  db: Db,
  programId: string,
): Promise<FilaLlamadaSinCloser[]> {
  const filas = await db
    .select({
      callId: calls.id,
      dealId: calls.dealId,
      emailLead: calls.emailLead,
      fechaAgenda: calls.fechaAgenda,
      hostEmail: calls.calendlyHostEmail,
    })
    .from(calls)
    .where(
      and(
        eq(calls.programId, programId),
        eq(calls.origen, ORIGEN_DE_SUELTA_ASIGNABLE),
        eq(calls.resultado, "agendada"),
        isNull(calls.closerUserId),
        isNotNull(calls.calendlyHostEmail),
        vigente(calls),
      ),
    );
  const dealIds = filas.flatMap((fila) => (fila.dealId ? [fila.dealId] : []));
  const personas = dealIds.length
    ? await db
        .select({ dealId: deals.id, leadNombre: leads.nombre, leadEmail: leads.emailNormalizado })
        .from(deals)
        .innerJoin(leads, eq(leads.id, deals.leadId))
        .where(and(eq(deals.programId, programId), inArray(deals.id, dealIds), vigente(deals)))
    : [];
  const personaPorDeal = new Map(personas.map((persona) => [persona.dealId, persona]));

  return filas
    .map((fila) => {
      const persona = fila.dealId ? personaPorDeal.get(fila.dealId) : null;
      return {
        callId: fila.callId,
        dealId: fila.dealId,
        leadNombre: persona?.leadNombre ?? null,
        leadEmail: persona?.leadEmail ?? fila.emailLead,
        fechaAgenda: fila.fechaAgenda,
        hostEmail: fila.hostEmail!,
      };
    })
    .sort((a, b) => (a.fechaAgenda?.getTime() ?? 0) - (b.fechaAgenda?.getTime() ?? 0));
}

// ───────────────────────────────────────────── sección 3: llamadas sueltas del programa

/**
 * Llamadas VIGENTES de Calendly con `deal_id` nulo (ADR 0049, `sueltaPorAsignar`): un closer
 * las cuelga de un deal desde aquí. Es de programa, no de dueño: una suelta no tiene dueño todavía.
 */
export async function llamadasSueltasDelPrograma(
  db: Db,
  programId: string,
  actor?: { userId: string; rol: Rol },
): Promise<FilaLlamada[]> {
  const filas = await db
    .select({
      callId: calls.id,
      fechaAgenda: calls.fechaAgenda,
      linkCalendly: calls.linkCalendly,
      emailLead: calls.emailLead,
      host: calls.calendlyHostEmail,
      raw: calls.raw,
    })
    .from(calls)
    .where(and(eq(calls.programId, programId), sueltaPorAsignar(), vigente(calls)));

  const [closers, abiertos, telefonos] = await Promise.all([
    closersConCalendly(db, programId),
    db
      .select({ dealId: deals.id, leadId: deals.leadId, leadNombre: leads.nombre, leadEmail: leads.emailNormalizado })
      .from(deals)
      .innerJoin(leads, eq(leads.id, deals.leadId))
      .where(and(
        eq(deals.programId, programId),
        notInArray(deals.etapa, [...CERRADAS]),
        vigente(deals),
      )),
    db
      .select({ leadId: leadContactos.leadId, valor: leadContactos.valor })
      .from(leadContactos)
      .where(and(eq(leadContactos.programId, programId), eq(leadContactos.tipo, "telefono"))),
  ]);
  const telefonosPorLead = new Map<string, Set<string>>();
  for (const telefono of telefonos) {
    const normalizado = normalizarTelefono(telefono.valor);
    if (!normalizado) continue;
    const delLead = telefonosPorLead.get(telefono.leadId) ?? new Set<string>();
    delLead.add(normalizado);
    telefonosPorLead.set(telefono.leadId, delLead);
  }
  filas.sort((a, b) => (a.fechaAgenda?.getTime() ?? 0) - (b.fechaAgenda?.getTime() ?? 0));
  return filas.map((f) => ({
    callId: f.callId,
    dealId: null,
    leadNombre: null,
    leadEmail: f.emailLead,
    fechaAgenda: f.fechaAgenda,
    linkCalendly: f.linkCalendly,
    ownerNombre: null,
    puedeColgar: actor
      ? puedeColgarSuelta({ actorUserId: actor.userId, rol: actor.rol, hostUserId: closerHost(f.host, closers as CloserDelPrograma[]) })
      : false,
    sugerencias: sugerenciasDeSuelta(f.raw, abiertos, telefonosPorLead),
  }));
}

function nombreComparable(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  return limpio || null;
}

function sugerenciasDeSuelta(
  raw: unknown,
  abiertos: readonly { dealId: string; leadId: string; leadNombre: string | null; leadEmail: string }[],
  telefonosPorLead: ReadonlyMap<string, ReadonlySet<string>>,
): SugerenciaDeSuelta[] {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
  const datos = raw as Record<string, unknown>;
  const nombre = nombreComparable(datos.nombre);
  const telefono = normalizarTelefono(datos.telefono);
  if (!nombre && !telefono) return [];
  return abiertos
    .filter((d) =>
      (nombre !== null && nombreComparable(d.leadNombre) === nombre)
      || (telefono !== null && telefonosPorLead.get(d.leadId)?.has(telefono) === true),
    )
    .map(({ dealId, leadNombre, leadEmail }) => ({ dealId, leadNombre, leadEmail }));
}

// ───────────────────────────────────────────── sección 4: lo mío que necesita atención

/**
 * Los deals vigentes del alcance, cada uno en el PRIMER bucket que casa (orden: abono sin
 * comprobante, re-agenda sin fecha, compromiso vencido, pago vencido, re-envío sin
 * atender, estancado). Completo solo entra por el primer motivo. Un deal aparece una vez.
 *
 * La "última actividad" no es una subconsulta correlacionada: se traen las cinco fuentes
 * (actividades, llamadas por creación y por cita, abonos, movimientos de etapa, y el
 * `created_at` del deal) por lote y se agrega en memoria el máximo por deal. Los abonos y
 * las llamadas se leen VIGENTES; un registro anulado no cuenta como actividad.
 */
async function seccionAtencion(
  db: Db,
  programId: string,
  alcance: AlcanceInbox,
  hoy: string,
  diasEstancado: number,
): Promise<FilaAtencion[]> {
  const abiertos = await db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      areaDeclaradaId: deals.areaDeclaradaId,
      etapa: deals.etapa,
      pendiente: deals.pendiente,
      fechaSeguimiento: deals.fechaSeguimiento,
      fechaLimitePago: deals.fechaLimitePago,
      createdAt: deals.createdAt,
      handoffEn: deals.handoffEn,
      ownerUserId: deals.ownerUserId,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      ownerNombre: users.nombre,
      ownerEmail: users.email,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        eq(deals.programId, programId),
        vigente(deals),
        notInArray(deals.etapa, ["cierre_perdido"]),
        alcanceDeDeal(alcance),
      ),
    );
  if (abiertos.length === 0) return [];

  const dealIds = abiertos.map((d) => d.dealId);
  const leadIds = [...new Set(abiertos.map((d) => d.leadId))];

  // (a) Re-agenda: ¿tiene una llamada vigente agendada a futuro? Si no, entra al bucket.
  const conCitaFutura = await citasFuturasPorDeal(db, dealIds, hoy);
  const conCitaVigente = await dealsConCitaVigente(db, dealIds);
  const sinComprobante = await dealsConAbonoSinComprobante(db, dealIds);

  // (c) Pago vencido con saldo: la MISMA cifra de la cartera (ADR 0024), acotada a estos deals.
  const cartera = await carteraVencida(db, programId, hoy);
  const vencidoPorDeal = new Map(cartera.vencidos.map((v) => [v.dealId, v]));

  // (d) Re-envío sin atender: último envío COMPLETO del lead vs. última actividad del deal.
  const ultimoEnvioCompleto = await ultimoEnvioCompletoPorLead(db, leadIds);
  const ultimaActividad = await ultimaActividadPorDeal(db, dealIds, abiertos);
  const intentosPorDeal = await intentosEnEtapaPorDeal(db, abiertos);

  const filas: FilaAtencion[] = [];
  for (const d of abiertos) {
    const owner = alcance === "equipo" ? (d.ownerNombre ?? d.ownerEmail ?? null) : null;
    const base = {
      dealId: d.dealId,
      areaDeclaradaId: d.areaDeclaradaId,
      leadNombre: d.leadNombre,
      leadEmail: d.leadEmail,
      etapa: d.etapa,
      aceptaAbono: aceptaAbono(d.etapa),
      ownerNombre: owner,
      saldo: null as number | null,
      moneda: null as string | null,
      fecha: null as string | null,
      diasSinActividad: null as number | null,
      intentos: null as number | null,
    };

    // El soporte faltante no invalida la venta, pero es la primera alerta operativa.
    if (sinComprobante.has(d.dealId)) {
      filas.push({ ...base, motivo: "abono_sin_comprobante" });
      continue;
    }
    // Un Completo solo vuelve al Inbox si le falta el soporte del pago.
    if (d.etapa === "ganado_completo") continue;

    // (a) Re-agenda sin nueva fecha.
    if (d.pendiente === "reagenda" && !conCitaFutura.has(d.dealId)) {
      filas.push({ ...base, motivo: "reagenda_sin_fecha" });
      continue;
    }

    // (b) Compromiso Verbal vencido: fecha límite de pago estrictamente anterior a hoy.
    if (d.etapa === "compromiso_verbal" && d.fechaLimitePago !== null && d.fechaLimitePago < hoy) {
      filas.push({ ...base, motivo: "compromiso_vencido", fecha: d.fechaLimitePago });
      continue;
    }

    // (c) Fecha límite de pago vencida con saldo (cartera vencida, ADR 0053).
    const vencido = vencidoPorDeal.get(d.dealId);
    if (vencido) {
      filas.push({ ...base, motivo: "pago_vencido", saldo: vencido.saldo, moneda: vencido.moneda, fecha: vencido.fechaLimite });
      continue;
    }

    // (d) Re-envío sin atender: el lead volvió a llenar el formulario (envío completo)
    // después de la última actividad del deal. DERIVADO, sin columna ni bandera nueva.
    const reenvio = ultimoEnvioCompleto.get(d.leadId);
    const actividad = ultimaActividad.get(d.dealId) ?? d.createdAt;
    if (reenvio != null && reenvio.getTime() > actividad.getTime()) {
      filas.push({ ...base, motivo: "reenvio_sin_atender" });
      continue;
    }

    const intentos = intentosPorDeal.get(d.dealId) ?? 0;
    if (intentos >= INTENTOS_PARA_ALERTA) {
      filas.push({ ...base, motivo: "intentos_agotados", intentos });
      continue;
    }

    if (linkEnviadoSinCita({ handoffEn: d.handoffEn, tieneCitaVigente: conCitaVigente.has(d.dealId), hoy })) {
      filas.push({ ...base, motivo: "link_sin_cita" });
      continue;
    }

    if (proximoContactoVencido(d, hoy)) {
      filas.push({ ...base, motivo: "proximo_contacto_vencido", fecha: d.fechaSeguimiento });
      continue;
    }

    // (e) Estancado: pasó más de X días HÁBILES sin actividad (por programa, ADR 0012).
    // `diasHabilesEntre` es inclusivo en ambos extremos, así que cuenta el día de la
    // actividad y hoy; el tramo transcurrido SIN actividad excluye el propio día de la
    // actividad, de ahí el `- 1`. Regla de Retia: solo sábados y domingos no cuentan, así
    // que un tramo de viernes a lunes vale 1 día hábil.
    const dias = diasHabilesEntre(diaDeCalendario(actividad), hoy);
    const habilesSinActividad = Math.max(dias - 1, 0);
    if (habilesSinActividad >= diasEstancado) {
      filas.push({ ...base, motivo: "estancado", diasSinActividad: habilesSinActividad });
      continue;
    }
  }

  // El orden de la lista respeta el orden de los buckets: los más urgentes arriba.
  const ORDEN: Record<MotivoAtencion, number> = {
    abono_sin_comprobante: 0,
    reagenda_sin_fecha: 1,
    compromiso_vencido: 2,
    pago_vencido: 3,
    reenvio_sin_atender: 4,
    intentos_agotados: 5,
    link_sin_cita: 6,
    proximo_contacto_vencido: 7,
    estancado: 8,
  };
  filas.sort((a, b) => ORDEN[a.motivo] - ORDEN[b.motivo] || a.leadEmail.localeCompare(b.leadEmail));
  return filas;
}

async function dealsConCitaVigente(db: Db, dealIds: string[]): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set();
  const filas = await db
    .select({ dealId: calls.dealId })
    .from(calls)
    .where(and(inArray(calls.dealId, dealIds), eq(calls.resultado, "agendada"), vigente(calls)));
  return new Set(filas.flatMap((fila) => fila.dealId ? [fila.dealId] : []));
}

/** El predicado de alcance sobre `deals`: un dueño concreto, o todo (equipo). */
function alcanceDeDeal(alcance: AlcanceInbox) {
  return alcance === "equipo" ? undefined : eq(deals.ownerUserId, alcance.ownerUserId);
}

/**
 * Los deals que tienen al menos una llamada VIGENTE agendada a FUTURO (cita en un día de
 * Bogotá posterior a hoy). Se filtra el día en memoria: nada de `Date` en `sql`.
 */
async function citasFuturasPorDeal(db: Db, dealIds: string[], hoy: string): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set();
  const filas = await db
    .select({ dealId: calls.dealId, fechaAgenda: calls.fechaAgenda })
    .from(calls)
    .where(and(inArray(calls.dealId, dealIds), eq(calls.resultado, "agendada"), vigente(calls)));
  const set = new Set<string>();
  for (const f of filas) {
    if (f.dealId != null && f.fechaAgenda != null && diaDeCalendario(f.fechaAgenda) > hoy) {
      set.add(f.dealId);
    }
  }
  return set;
}

/**
 * El último envío COMPLETO (no parcial) por lead, como instante. Un re-envío parcial no
 * cuenta: el bucket es "volvió a llenar el formulario", y un parcial abandonado no lo es.
 */
async function ultimoEnvioCompletoPorLead(db: Db, leadIds: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (leadIds.length === 0) return map;
  const filas = await db
    .select({ leadId: submissions.leadId, fechaEnvio: submissions.fechaEnvio, createdAt: submissions.createdAt })
    .from(submissions)
    .where(and(inArray(submissions.leadId, leadIds), eq(submissions.esParcial, false)));
  for (const f of filas) {
    if (f.leadId == null) continue;
    // Un envío sin `fechaEnvio` cae al `createdAt`: el hecho de re-enviar es lo que importa.
    const cuando = f.fechaEnvio ?? f.createdAt;
    const previo = map.get(f.leadId);
    if (!previo || cuando.getTime() > previo.getTime()) map.set(f.leadId, cuando);
  }
  return map;
}


// ───────────────────────────────────────────── buscar deals abiertos (para asignar suelta)

/** Un deal abierto del programa, para el selector de "asignar llamada suelta". */
export interface DealAbiertoBuscado {
  dealId: string;
  leadNombre: string | null;
  leadEmail: string;
  etapa: EtapaDeal;
}

/**
 * Los deals abiertos y VIGENTES del programa cuyo lead casa el texto (nombre o correo),
 * para el selector de "asignar una llamada suelta a un deal". El programa es frontera
 * (ADR 0043): recibe `programId` y no cruza. El filtro por texto se hace en memoria a esta
 * escala (los abiertos de un programa), sin `ILIKE` correlacionado ni `Date` en `sql`.
 *
 * NO estrecha por dueño: una suelta se puede colgar de cualquier deal abierto del programa;
 * la reja de quién puede hacerlo la aplica `asignarLlamadaSuelta`, no esta lectura.
 */
export async function buscarDealsAbiertos(
  db: Db,
  programId: string,
  texto: string,
  limite = 20,
): Promise<DealAbiertoBuscado[]> {
  const filas = await db
    .select({
      dealId: deals.id,
      etapa: deals.etapa,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(
      eq(deals.programId, programId),
      vigente(deals),
      notInArray(deals.etapa, [...CERRADAS]),
    ));

  const q = texto.trim().toLowerCase();
  const casan = q === "" ? filas : filas.filter((f) => (f.leadNombre ?? "").toLowerCase().includes(q) || f.leadEmail.toLowerCase().includes(q));
  return casan
    .sort((a, b) => (a.leadNombre ?? a.leadEmail).localeCompare(b.leadNombre ?? b.leadEmail, "es"))
    .slice(0, limite)
    .map((f) => ({ dealId: f.dealId, leadNombre: f.leadNombre, leadEmail: f.leadEmail, etapa: f.etapa }));
}
