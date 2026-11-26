import { and, inArray } from "drizzle-orm";
import { calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { tableroKanban, type TarjetaDeal } from "@/lib/queries/kanban";
import type { AlcanceDeals } from "@/lib/auth/alcance-deals";
import { vigente } from "@/lib/queries/vigente";
import { esAtendidaSinGrain } from "@/lib/queries/sin-grain";
import { novedadesCalendlyDeUsuario } from "@/lib/notificaciones-calendly/notificaciones";
import { hoyEnBogota } from "@/lib/format";
import { citaCuentaComoPorMarcar } from "@/lib/deals/resultados-de-llamada";
import { fechaDeAbonoSinComprobantePorDeal } from "@/lib/deals/abono-sin-comprobante";

/**
 * Los predicados históricos de pendientes de Mi espacio, sobre las mismas tarjetas de Deal.
 * El builder de `pendientes.ts` los proyecta sin reescribir sus reglas; `conteoSinVer`
 * conserva aparte el contrato del distintivo del menú.
 *
 * El universo es siempre los deals de la sesión como dueño en el programa elegido
 * (`tableroKanban` con alcance `dueno`): así un deal de otro programa o de otro dueño no
 * puede aparecer en ningún chip, porque nunca entra al universo. Los datos que a la
 * tarjeta le faltan (la fecha de seguimiento y la fecha límite de pago del deal, ambas
 * `date`, y las llamadas vigentes) salen de UNA lectura extra cada uno, por `inArray` sobre
 * los ids del universo; las llamadas pasan por `vigente(calls)` (obligatorio: lo exige el
 * guardián de vigencia).
 */

/** Tipos que siguen usando los predicados históricos de Notificaciones. */
export type ChipNotificacion =
  | "reagenda"
  | "seguimiento"
  | "vencidos"
  | "sin_comprobante"
  | "sin_grain"
  | "sin_resultado"
  | "calendly"
  | "nuevos";

/** Lo extra que la tarjeta no trae: las dos fechas `date` del deal. */
interface FechasDeDeal {
  fechaSeguimiento: string | null;
  fechaLimitePago: string | null;
}

/** Una tarjeta ya resuelta para un chip, con la fecha que ese chip ordena y muestra. */
interface TarjetaNotificacion {
  tarjeta: TarjetaDeal;
  /** La fecha que importa en el chip activo (día de calendario o instante), o `null`. */
  fechaClave: Date | string | null;
}

/** La lista completa de un chip con la fecha que ya usa Mi espacio para ordenarlo. */
export interface NotificacionCompleta {
  tarjeta: TarjetaDeal;
  fechaClave: Date | string | null;
}

/** El universo + lo extra, leído una sola vez y reutilizado por todos los predicados. */
interface Universo {
  tarjetas: TarjetaDeal[];
  /** Fechas `date` del deal, por dealId. */
  fechas: Map<string, FechasDeDeal>;
  /** La llamada Show sin Grain más antigua de cada deal (ticket 226), por dealId. */
  showSinGrain: Map<string, Date>;
  /** El abono vigente sin comprobante más antiguo de cada deal (ticket 428), por dealId. */
  abonoSinComprobante: Map<string, string>;
  /** La cita pasada sin resultado más antigua de cada deal (390), por dealId: lo que el closer debe marcar. */
  citaSinResultado: Map<string, Date>;
}

/**
 * El universo del closer, una vez por solicitud: Mi espacio lo pide para el chip, los conteos y "sin ver" (437).
 * Sin `ahora` explícito comparten el instante de la primera lectura; con él, la clave lo incluye.
 */
function cargarUniverso(
  db: Db,
  programId: string,
  userId: string,
  hoy: string,
  ahora?: Date,
): Promise<Universo> {
  return unaVezPorSolicitud(db, claveDe("universoDeNotificaciones", programId, userId, hoy, ahora ?? null),
    () => leerUniverso(db, programId, userId, hoy, ahora ?? new Date()));
}

async function leerUniverso(
  db: Db,
  programId: string,
  userId: string,
  hoy: string,
  ahora: Date,
): Promise<Universo> {
  const alcance: AlcanceDeals = { tipo: "dueno", userId };
  const tablero = await tableroKanban(db, programId, alcance, {}, hoy);
  // Próxima Cohorte queda fuera de estas filas, pero sigue dentro del universo del tablero.
  const tarjetas = [...tablero.columnas.flatMap((c) => c.tarjetas), ...tablero.enProximaCohorte];

  const ids = tarjetas.map((t) => t.dealId);

  const fechas = new Map<string, FechasDeDeal>();
  const showSinGrain = new Map<string, Date>();
  const citaSinResultado = new Map<string, Date>();
  let abonoSinComprobante = new Map<string, string>();
  const etapaPorDeal = new Map(tarjetas.map((t) => [t.dealId, t.etapa as string]));
  if (ids.length > 0) {
    const filasDeal = await db
      .select({
        dealId: deals.id,
        fechaSeguimiento: deals.fechaSeguimiento,
        fechaLimitePago: deals.fechaLimitePago,
      })
      .from(deals)
      .where(and(inArray(deals.id, ids), vigente(deals)));
    for (const f of filasDeal) {
      fechas.set(f.dealId, {
        fechaSeguimiento: f.fechaSeguimiento,
        fechaLimitePago: f.fechaLimitePago,
      });
    }

    abonoSinComprobante = await fechaDeAbonoSinComprobantePorDeal(db, ids);

    // Llamadas VIGENTES de los deals del universo (vigente(calls) obligatorio). Nos quedamos
    // con la más reciente por deal; la fecha de la llamada es un timestamp (instante).
    const filasCall = await db
      .select({
        dealId: calls.dealId,
        fechaLlamada: calls.fechaLlamada,
        fechaAgenda: calls.fechaAgenda,
        resultado: calls.resultado,
        linkGrain: calls.linkGrain,
        anuladoEn: calls.anuladoEn,
      })
      .from(calls)
      .where(and(inArray(calls.dealId, ids), vigente(calls)));
    for (const c of filasCall) {
      // Sin Grain (226): la MISMA regla de la ficha y el dashboard (`esAtendidaSinGrain`,
      // ADR 0066); nos quedamos con la llamada más antigua de cada deal.
      if (c.dealId && c.fechaLlamada && esAtendidaSinGrain(c)) {
        const previa = showSinGrain.get(c.dealId);
        if (!previa || c.fechaLlamada < previa) showSinGrain.set(c.dealId, c.fechaLlamada);
      }
      // Por marcar (390): la MISMA regla que el Inbox y la bandera del Hub (`citaCuentaComoPorMarcar`).
      if (c.dealId && citaCuentaComoPorMarcar({ ...c, etapaDelDeal: etapaPorDeal.get(c.dealId) ?? null }, ahora)) {
        const hora = (c.fechaAgenda ?? c.fechaLlamada)!;
        const previa = citaSinResultado.get(c.dealId);
        if (!previa || hora < previa) citaSinResultado.set(c.dealId, hora);
      }
    }
  }

  return { tarjetas, fechas, showSinGrain, abonoSinComprobante, citaSinResultado };
}

/** ¿La tarjeta pasa el chip? Y, de pasar, ¿cuál es su fecha clave para ordenar y mostrar? */
function evaluar(
  u: Universo,
  t: TarjetaDeal,
  chip: ChipNotificacion,
  idsCalendly: Map<string, Date>,
): { pasa: boolean; fechaClave: Date | string | null } {
  const fechas = u.fechas.get(t.dealId);
  const seguimiento = fechas?.fechaSeguimiento ?? null;
  const limitePago = fechas?.fechaLimitePago ?? null;

  switch (chip) {
    case "reagenda":
      return { pasa: t.pendiente === "reagenda", fechaClave: seguimiento };
    case "seguimiento":
      return { pasa: t.pendiente === "seguimiento", fechaClave: seguimiento };
    case "vencidos": {
      // Los avisos propios de la tarjeta, no reescritos (sin Grain tiene su chip, 226).
      const vencido =
        t.avisos.seguimientoVencido || t.avisos.compromisoVencido || t.avisos.carteraVencida;
      // La fecha vencida más antigua: el seguimiento o el límite de pago, el menor de los dos.
      const candidatas = [
        t.avisos.seguimientoVencido ? seguimiento : null,
        (t.avisos.compromisoVencido || t.avisos.carteraVencida) ? limitePago : null,
      ].filter((x): x is string => x != null);
      const masAntigua = candidatas.length > 0 ? candidatas.sort()[0] : null;
      return { pasa: vencido, fechaClave: masAntigua };
    }
    case "sin_comprobante": {
      const fecha = u.abonoSinComprobante.get(t.dealId) ?? null;
      return { pasa: fecha != null, fechaClave: fecha };
    }
    case "sin_grain": {
      const llamada = u.showSinGrain.get(t.dealId) ?? null;
      return { pasa: llamada != null, fechaClave: llamada };
    }
    case "sin_resultado": {
      const cita = u.citaSinResultado.get(t.dealId) ?? null;
      return { pasa: cita != null, fechaClave: cita };
    }
    case "calendly":
      return { pasa: idsCalendly.has(t.dealId), fechaClave: idsCalendly.get(t.dealId) ?? null };
    case "nuevos":
      return { pasa: t.esNuevo, fechaClave: t.creadoEn };
  }
}

/** El comparador de orden de cada chip, sobre las tarjetas ya evaluadas (con su fecha clave). */
function compararPorChip(
  chip: ChipNotificacion,
  a: TarjetaNotificacion,
  b: TarjetaNotificacion,
): number {
  const fa = valorDeFecha(a.fechaClave);
  const fb = valorDeFecha(b.fechaClave);
  switch (chip) {
    case "reagenda":
    case "seguimiento":
      // Por fecha de seguimiento ascendente.
      return (fa - fb) || desempate(a, b);
    case "vencidos":
    case "sin_comprobante":
    case "sin_grain":
    case "sin_resultado":
      // El vencido (o el Show sin Grain) más antiguo primero (fecha ascendente).
      return (fa - fb) || desempate(a, b);
    case "calendly":
      // La novedad más reciente primero (descendente).
      return (fb - fa) || desempate(a, b);
    case "nuevos":
      // Por creación descendente.
      return (fb - fa) || desempate(a, b);
  }
}

/** Un valor numérico comparable de una fecha clave; `null` va al final (infinito). */
function valorDeFecha(f: Date | string | null): number {
  if (f == null) return Number.POSITIVE_INFINITY;
  if (f instanceof Date) return f.getTime();
  // 'YYYY-MM-DD': se compara como instante del día en Bogotá para un orden estable.
  return new Date(`${f}T00:00:00-05:00`).getTime();
}

/** Desempate estable por dealId, para que el orden no dependa del azar. */
function desempate(a: TarjetaNotificacion, b: TarjetaNotificacion): number {
  return a.tarjeta.dealId < b.tarjeta.dealId ? -1 : a.tarjeta.dealId > b.tarjeta.dealId ? 1 : 0;
}

/**
 * La misma proyeccion de un chip, sin paginar y conservando su fecha clave. Los avisos de
 * registros pendientes la necesitan para agrupar varios chips por deal; no redefine ningun
 * predicado: pasa por `cargarUniverso`, `evaluar` y `compararPorChip`, igual que la pantalla.
 */
export async function notificacionesCompletasDeChip(
  db: Db,
  args: { programId: string; userId: string; chip: ChipNotificacion },
  hoy: string = hoyEnBogota(),
  ahora: Date = new Date(),
): Promise<NotificacionCompleta[]> {
  const universo = await cargarUniverso(db, args.programId, args.userId, hoy, ahora);
  const evaluadas: NotificacionCompleta[] = [];
  const idsCalendly = args.chip === "calendly"
    ? (await idsConNovedadCalendly(db, args.userId, args.programId)).todas
    : new Map<string, Date>();
  for (const tarjeta of universo.tarjetas) {
    const resultado = evaluar(universo, tarjeta, args.chip, idsCalendly);
    if (resultado.pasa) evaluadas.push({ tarjeta, fechaClave: resultado.fechaClave });
  }
  evaluadas.sort((a, b) => compararPorChip(args.chip, a, b));
  return evaluadas;
}

/**
 * El "número sin ver" (ticket 223): cuántos DEALS del closer en el programa tienen algo
 * nuevo que el dueño no ha visto todavía. Un deal cuenta si cumple AL MENOS UNO de:
 *  - tiene una novedad de Calendly SIN leer (`leidaEn` null) para este usuario+programa;
 *  - es nuevo y el dueño no lo ha abierto (`tarjeta.esNuevo`);
 *  - tiene un pendiente de `reagenda`/`seguimiento` con fecha de hoy o ya vencida (Bogotá).
 *
 * Un deal que cumple dos razones cuenta UNA vez. Reutiliza el mismo universo y los mismos
 * predicados que los chips (nunca una segunda consulta de los mismos hechos): sale de la
 * misma carga del universo y de la misma lectura de novedades de Calendly.
 */
export async function conteoSinVer(
  db: Db,
  args: { programId: string; userId: string },
  hoy: string = hoyEnBogota(),
): Promise<number> {
  const { programId, userId } = args;
  const universo = await cargarUniverso(db, programId, userId, hoy);
  const novedadesCalendly = await idsConNovedadCalendly(db, userId, programId);

  let total = 0;
  for (const t of universo.tarjetas) {
    if (deberiaVerse(universo, t, novedadesCalendly.sinLeer, hoy)) total += 1;
  }
  return total;
}

/** ¿Este deal tiene algo sin ver? Las tres razones del circulito, una basta. */
function deberiaVerse(
  u: Universo,
  t: TarjetaDeal,
  calendlySinLeer: Set<string>,
  hoy: string,
): boolean {
  if (calendlySinLeer.has(t.dealId)) return true;
  if (t.esNuevo) return true;
  const seguimiento = u.fechas.get(t.dealId)?.fechaSeguimiento ?? null;
  const pendienteConFecha =
    (t.pendiente === "reagenda" || t.pendiente === "seguimiento") &&
    seguimiento != null &&
    seguimiento <= hoy;
  return pendienteConFecha;
}

/** Novedades de Calendly del universo: todas (leídas o no) y el subconjunto no leído. */
interface NovedadesCalendly {
  /** dealId -> fecha de su novedad más reciente (leída o no); el chip ordena por ella. */
  todas: Map<string, Date>;
  /** dealIds con al menos una novedad SIN leer (`leidaEn` null); lo usa `conteoSinVer`. */
  sinLeer: Set<string>;
}

/**
 * Los dealId del usuario+programa con una novedad de Calendly, del 201. `todas` lleva la
 * fecha de la novedad más reciente (el chip ordena por ella, leídas o no); `sinLeer` son los
 * deals con al menos una novedad sin leer (`leidaEn` null), que es lo que cuenta el circulito
 * del 223.
 * ponytail: lee hasta 500 por grupo; si un closer acumula más, pedir un lector sin tope.
 */
function idsConNovedadCalendly(db: Db, userId: string, programId: string): Promise<NovedadesCalendly> {
  return unaVezPorSolicitud(db, claveDe("idsConNovedadCalendly", userId, programId), () => leerIdsConNovedadCalendly(db, userId, programId));
}

async function leerIdsConNovedadCalendly(db: Db, userId: string, programId: string): Promise<NovedadesCalendly> {
  const { noLeidas, leidas } = await novedadesCalendlyDeUsuario(db, { userId, programId, porGrupo: 500 });
  const todas = new Map<string, Date>();
  for (const n of [...noLeidas, ...leidas]) {
    const previa = todas.get(n.dealId);
    if (!previa || n.createdAt > previa) todas.set(n.dealId, n.createdAt);
  }
  const sinLeer = new Set(noLeidas.map((n) => n.dealId));
  return { todas, sinLeer };
}
