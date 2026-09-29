import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import {
  abonos,
  calls,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  programs,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { diaDeCalendario, diasHabilesEntre } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import { carteraVencida } from "@/lib/queries/cartera";
import { vigente } from "@/lib/queries/vigente";

/**
 * El READ MODEL del Inbox (ticket 071, ADR 0050): lo que un closer tiene que hacer HOY,
 * sin filtrar nada. Reemplaza a `/mi-dia`. UNA sola función, `inboxDelPrograma`, que arma
 * cada sección con consultas simples unidas en memoria.
 *
 * Las secciones "sin dueño" (Pendiente Setteo y Agendados sin dueño) NO están aquí: viven
 * en `lib/queries/inbox-sin-dueno.ts` (ticket 070) y la pantalla las intercala. Aquí van:
 *
 *  1. **Llamadas de hoy sin resultado** — el dolor número uno (reunión con closers,
 *     24-sep): llamadas VIGENTES de MIS deals cuya cita (día de Bogotá) es hoy o antes y
 *     cuyo `resultado` sigue en `agendada`. Es la red de seguridad para ponerse al día al
 *     final de un bloque de llamadas.
 *  3. **Llamadas sueltas** del programa (ADR 0049, decisión K2): llamadas vigentes con
 *     `deal_id` nulo, que un closer asigna a un deal desde aquí.
 *  4. **Lo mío que necesita atención**: MIS deals abiertos y vigentes, cada uno en UN solo
 *     bucket, el primero que casa en este orden: re-agenda sin fecha, compromiso vencido,
 *     fecha límite vencida con saldo, re-envío sin atender, estancado.
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
const CERRADAS: EtapaDeal[] = ["completo", "cierre_perdido"];

/** El motivo por el que un deal cayó en "lo mío que necesita atención". */
export type MotivoAtencion =
  | "reagenda_sin_fecha"
  | "compromiso_vencido"
  | "pago_vencido"
  | "reenvio_sin_atender"
  | "estancado";

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
}

/** Una fila de "lo mío que necesita atención" (sección 4). */
export interface FilaAtencion {
  dealId: string;
  leadNombre: string | null;
  leadEmail: string;
  etapa: EtapaDeal;
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
}

export interface Inbox {
  /** Sección 1: llamadas de hoy o vencidas sin resultado, la más vieja primero. */
  llamadasDeHoy: FilaLlamada[];
  /** Sección 3: llamadas sueltas del programa, la más vieja primero. */
  llamadasSueltas: FilaLlamada[];
  /** Sección 4: lo mío que necesita atención, agrupado por motivo (en orden de bucket). */
  atencion: FilaAtencion[];
}

/** El alcance del Inbox: un dueño (el closer) o todo el equipo (quien administra). */
export type AlcanceInbox = { ownerUserId: string } | "equipo";

export async function inboxDelPrograma(
  db: Db,
  programId: string,
  alcance: AlcanceInbox,
  hoy: string = hoyEnBogota(),
): Promise<Inbox> {
  // Cuántos días hábiles sin actividad marcan "estancado" (por programa, ADR 0012).
  const [programa] = await db
    .select({ diasSinActividad: programs.diasSinActividad })
    .from(programs)
    .where(eq(programs.id, programId));
  const diasEstancado = programa?.diasSinActividad ?? 3;

  const [llamadasDeHoy, llamadasSueltas, atencion] = await Promise.all([
    seccionLlamadasDeHoy(db, programId, alcance, hoy),
    seccionLlamadasSueltas(db, programId),
    seccionAtencion(db, programId, alcance, hoy, diasEstancado),
  ]);

  return { llamadasDeHoy, llamadasSueltas, atencion };
}

// ───────────────────────────────────────────── sección 1: llamadas de hoy sin resultado

/**
 * Llamadas VIGENTES en `agendada` cuya cita (día de Bogotá) es hoy o anterior, de deals
 * abiertos y vigentes del alcance. No se interpola el `Date` en `sql`: se traen las
 * agendadas del programa y se filtra el día en memoria por `diaDeCalendario` (Bogotá),
 * que es la única definición de "qué día es" del proyecto.
 */
async function seccionLlamadasDeHoy(
  db: Db,
  programId: string,
  alcance: AlcanceInbox,
  hoy: string,
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
        eq(calls.resultado, "agendada"),
        vigente(calls),
        vigente(deals),
        notInArray(deals.etapa, CERRADAS),
        alcanceDeDeal(alcance),
      ),
    );

  const soloAlDia = filas.filter((f) => f.fechaAgenda != null && diaDeCalendario(f.fechaAgenda) <= hoy);
  // La más vieja primero: es la que más urge ponerse al día.
  soloAlDia.sort((a, b) => (a.fechaAgenda?.getTime() ?? 0) - (b.fechaAgenda?.getTime() ?? 0));
  return soloAlDia.map((f) => ({
    callId: f.callId,
    dealId: f.dealId,
    leadNombre: f.leadNombre,
    leadEmail: f.leadEmail,
    fechaAgenda: f.fechaAgenda,
    linkCalendly: f.linkCalendly,
    ownerNombre: alcance === "equipo" ? (f.ownerNombre ?? f.ownerEmail ?? null) : null,
  }));
}

// ───────────────────────────────────────────── sección 3: llamadas sueltas del programa

/**
 * Llamadas VIGENTES del programa con `deal_id` nulo (ADR 0049): un closer las cuelga de un
 * deal desde aquí. Es de programa, no de dueño: una suelta no tiene dueño todavía.
 */
async function seccionLlamadasSueltas(db: Db, programId: string): Promise<FilaLlamada[]> {
  const filas = await db
    .select({
      callId: calls.id,
      fechaAgenda: calls.fechaAgenda,
      linkCalendly: calls.linkCalendly,
      emailLead: calls.emailLead,
    })
    .from(calls)
    .where(and(eq(calls.programId, programId), isNull(calls.dealId), vigente(calls)));

  filas.sort((a, b) => (a.fechaAgenda?.getTime() ?? 0) - (b.fechaAgenda?.getTime() ?? 0));
  return filas.map((f) => ({
    callId: f.callId,
    dealId: null,
    leadNombre: null,
    leadEmail: f.emailLead,
    fechaAgenda: f.fechaAgenda,
    linkCalendly: f.linkCalendly,
    ownerNombre: null,
  }));
}

// ───────────────────────────────────────────── sección 4: lo mío que necesita atención

/**
 * Los deals abiertos y vigentes del alcance, cada uno en el PRIMER bucket que casa
 * (orden: re-agenda sin fecha, compromiso vencido, pago vencido, re-envío sin atender,
 * estancado). Un deal aparece una sola vez.
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
      etapa: deals.etapa,
      fechaLimitePago: deals.fechaLimitePago,
      createdAt: deals.createdAt,
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
        notInArray(deals.etapa, CERRADAS),
        alcanceDeDeal(alcance),
      ),
    );
  if (abiertos.length === 0) return [];

  const dealIds = abiertos.map((d) => d.dealId);
  const leadIds = [...new Set(abiertos.map((d) => d.leadId))];

  // (a) Re-agenda: ¿tiene una llamada vigente agendada a futuro? Si no, entra al bucket.
  const conCitaFutura = await citasFuturasPorDeal(db, dealIds, hoy);

  // (c) Pago vencido con saldo: la MISMA cifra de la cartera (ADR 0024), acotada a estos deals.
  const cartera = await carteraVencida(db, programId, hoy);
  const vencidoPorDeal = new Map(cartera.vencidos.map((v) => [v.dealId, v]));

  // (d) Re-envío sin atender: último envío COMPLETO del lead vs. última actividad del deal.
  const ultimoEnvioCompleto = await ultimoEnvioCompletoPorLead(db, leadIds);
  const ultimaActividad = await ultimaActividadPorDeal(db, dealIds, abiertos);

  const filas: FilaAtencion[] = [];
  for (const d of abiertos) {
    const owner = alcance === "equipo" ? (d.ownerNombre ?? d.ownerEmail ?? null) : null;
    const base = {
      dealId: d.dealId,
      leadNombre: d.leadNombre,
      leadEmail: d.leadEmail,
      etapa: d.etapa,
      ownerNombre: owner,
      saldo: null as number | null,
      moneda: null as string | null,
      fecha: null as string | null,
      diasSinActividad: null as number | null,
    };

    // (a) Re-agenda sin nueva fecha.
    if (d.etapa === "pendiente_reagenda" && !conCitaFutura.has(d.dealId)) {
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
    reagenda_sin_fecha: 0,
    compromiso_vencido: 1,
    pago_vencido: 2,
    reenvio_sin_atender: 3,
    estancado: 4,
  };
  filas.sort((a, b) => ORDEN[a.motivo] - ORDEN[b.motivo] || a.leadEmail.localeCompare(b.leadEmail));
  return filas;
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

/**
 * La última actividad por deal, como instante: el máximo entre actividades, llamadas (por
 * creación y por cita), abonos y movimientos de etapa. El `created_at` del deal lo aporta
 * el llamador (así un deal recién creado sin ningún registro tiene una fecha base). Los
 * abonos y las llamadas se leen VIGENTES: un registro anulado no cuenta como actividad.
 */
async function ultimaActividadPorDeal(
  db: Db,
  dealIds: string[],
  deals_: { dealId: string; createdAt: Date }[],
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  const anota = (dealId: string | null, cuando: Date | null | undefined) => {
    if (dealId == null || cuando == null) return;
    const previo = map.get(dealId);
    if (!previo || cuando.getTime() > previo.getTime()) map.set(dealId, cuando);
  };

  // La base: el created_at del deal, para el que no tiene ningún otro registro.
  for (const d of deals_) anota(d.dealId, d.createdAt);
  if (dealIds.length === 0) return map;

  const [actividades, llamadas, pagos, movimientos] = await Promise.all([
    db
      .select({ dealId: dealActividades.dealId, fecha: dealActividades.fecha })
      .from(dealActividades)
      .where(inArray(dealActividades.dealId, dealIds)),
    db
      .select({ dealId: calls.dealId, createdAt: calls.createdAt, fechaAgenda: calls.fechaAgenda })
      .from(calls)
      .where(and(inArray(calls.dealId, dealIds), vigente(calls))),
    db
      .select({ dealId: abonos.dealId, fecha: abonos.fecha })
      .from(abonos)
      .where(and(inArray(abonos.dealId, dealIds), vigente(abonos))),
    db
      .select({ dealId: dealEtapaHistorial.dealId, fecha: dealEtapaHistorial.fecha })
      .from(dealEtapaHistorial)
      .where(inArray(dealEtapaHistorial.dealId, dealIds)),
  ]);

  for (const a of actividades) anota(a.dealId, a.fecha);
  for (const c of llamadas) {
    anota(c.dealId, c.createdAt);
    anota(c.dealId, c.fechaAgenda);
  }
  // `abonos.fecha` es un día de calendario (`date`): se lee a medianoche de Bogotá.
  for (const p of pagos) anota(p.dealId, p.fecha ? new Date(`${p.fecha}T00:00:00-05:00`) : null);
  for (const m of movimientos) anota(m.dealId, m.fecha);

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
    .where(and(eq(deals.programId, programId), vigente(deals), notInArray(deals.etapa, CERRADAS)));

  const q = texto.trim().toLowerCase();
  const casan = q === "" ? filas : filas.filter((f) => (f.leadNombre ?? "").toLowerCase().includes(q) || f.leadEmail.toLowerCase().includes(q));
  return casan
    .sort((a, b) => (a.leadNombre ?? a.leadEmail).localeCompare(b.leadNombre ?? b.leadEmail, "es"))
    .slice(0, limite)
    .map((f) => ({ dealId: f.dealId, leadNombre: f.leadNombre, leadEmail: f.leadEmail, etapa: f.etapa }));
}
