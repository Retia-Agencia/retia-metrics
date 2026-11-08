import { and, eq, inArray } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, calls, deals, leads, motivos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { etiquetaDeCloser } from "@/lib/closers/identidad";
import { ocurrioSql } from "@/lib/deals/resultados-de-llamada";
import { hoyEnBogota } from "@/lib/format";
import { diaDeLaSemana, sumarDias } from "@/lib/dias-habiles";
import { nombreCorto } from "@/lib/vocabulario-metricas";
import { listaDeMetrica, TAMANO_PAGINA, type FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { showPorCitaDelRango } from "@/lib/queries/tasa-show-por-cita";
import { fechaAnclaCall, filtroCaja, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { agrupar as agruparEnvios } from "@/lib/queries/hechos/envio";
import { armarVistaDeHoy } from "@/lib/queries/vista-hoy";
import type { ContextoDeVista } from "@/lib/queries/vista-dashboard";
import type { VentanaRitmo } from "@/lib/queries/proyeccion";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

/**
 * Hub › Hoy como el reporte diario de Michael (ticket 373, plantilla v5 del 15-sep). Este módulo NO
 * calcula una métrica nueva: arma el día con `armarVistaDeHoy` (las cifras de 252, 299, 352, 367, 369) y
 * agrega lo que la plantilla pedía y no existía junto: cómo nació cada venta, el desglose de la caja
 * con la venta de origen y qué pasó con cada agenda. El texto interpretativo no se genera.
 */

export type NacimientoDeVenta = "agenda_del_dia" | "seguimiento" | "sin_llamada";

export const ETIQUETA_DE_NACIMIENTO: Record<NacimientoDeVenta, string> = {
  agenda_del_dia: nombreCorto("nacio_agenda_del_dia"),
  seguimiento: nombreCorto("nacio_seguimiento"),
  sin_llamada: nombreCorto("nacio_sin_llamada"),
};

/**
 * Cómo nació una venta (G-10): la UNICA respuesta. `diasConShow` son los días de Bogotá de las llamadas
 * que ocurrieron del deal. Show el mismo día de la venta = agenda del día; el último show de un día
 * anterior = seguimiento; ninguno hasta ese día = sin llamada. Un show posterior a la venta no la explica.
 */
export function comoNacioLaVenta(diaDeVenta: string, diasConShow: readonly string[]): NacimientoDeVenta {
  const hasta = diasConShow.filter((d) => d <= diaDeVenta);
  if (hasta.length === 0) return "sin_llamada";
  return hasta.includes(diaDeVenta) ? "agenda_del_dia" : "seguimiento";
}

async function diasConShowPorDeal(db: Db, dealIds: readonly string[]): Promise<Map<string, string[]>> {
  const porDeal = new Map<string, string[]>();
  if (dealIds.length === 0) return porDeal;
  const filas = await db
    .select({ dealId: calls.dealId, dia: fechaAnclaCall() })
    .from(calls)
    .where(and(inArray(calls.dealId, [...dealIds]), ocurrioSql(), vigente(calls)));
  for (const f of filas) {
    if (!f.dealId) continue;
    porDeal.set(f.dealId, [...(porDeal.get(f.dealId) ?? []), f.dia]);
  }
  return porDeal;
}

export interface VentaDelReporte {
  id: string;
  persona: string | null;
  closer: string | null;
  vendido: number | null;
  recaudado: number | null;
  porCobrar: number | null;
  nacio: NacimientoDeVenta;
}

export interface AbonoDeCaja {
  id: string;
  persona: string | null;
  moneda: string;
  monto: number;
  /** Venta del día, saldo de una venta anterior, o un abono adicional (1:1). */
  origen: "venta_nueva" | "saldo_anterior" | "adicional";
  /** Solo en `saldo_anterior`: el día y el closer de la venta que se completa. */
  ventaDelDia: string | null;
  closerDeLaVenta: string | null;
}

/** El conteo de agendas por resultado, por closer: "9 agendas: 1 cierre, 2 no-show...". */
export interface ResultadosDeCloser {
  claveCloser: string;
  closer: string | null;
  agendas: number;
  cierre: number;
  show: number;
  noShow: number;
  reagendada: number;
  pendiente: number;
  compromisoDePago: number;
  canceladas: number;
  perdidas: Array<{ motivo: string; cantidad: number }>;
}

export function resultadosPorCloser(
  filas: ReadonlyArray<Pick<FilaDeMetrica, "claveCloser" | "closer" | "resultado"> & { motivo?: string | null }>,
): ResultadosDeCloser[] {
  const porClave = new Map<string, ResultadosDeCloser>();
  for (const f of filas) {
    const r = porClave.get(f.claveCloser) ?? {
      claveCloser: f.claveCloser, closer: f.closer, agendas: 0, cierre: 0, show: 0, noShow: 0, reagendada: 0,
      pendiente: 0, compromisoDePago: 0, canceladas: 0, perdidas: [],
    };
    porClave.set(f.claveCloser, r);
    if (f.resultado === "cancelada") { r.canceladas += 1; continue; }
    r.agendas += 1;
    switch (f.resultado) {
      case "cerrada": r.cierre += 1; break;
      case "show": r.show += 1; break;
      case "no_show": r.noShow += 1; break;
      case "reagendada": r.reagendada += 1; break;
      case "compromiso_pago": r.compromisoDePago += 1; break;
      case "perdida": {
        const motivo = f.motivo?.trim() || "sin motivo";
        const existente = r.perdidas.find((p) => p.motivo === motivo);
        if (existente) existente.cantidad += 1; else r.perdidas.push({ motivo, cantidad: 1 });
        break;
      }
      default: r.pendiente += 1;
    }
  }
  return [...porClave.values()].sort((a, b) => (a.closer ?? "~").localeCompare(b.closer ?? "~", "es"));
}

async function todasLasFilas(metrica: "cierres", programId: string, dia: string, ahora: Date, db: Db): Promise<FilaDeMetrica[]> {
  const filas: FilaDeMetrica[] = [];
  let pagina = 1;
  let total = 0;
  do {
    const [seccion] = await listaDeMetrica(metrica, { programId, rango: { desde: dia, hasta: dia }, hoy: dia, ahora }, pagina, db);
    total = seccion.subtotal.cantidad;
    filas.push(...seccion.filas);
    pagina += 1;
    if (seccion.filas.length < TAMANO_PAGINA) break;
  } while (filas.length < total);
  return filas;
}

async function motivosDeAgendas(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const filas = await db
    .select({ id: calls.id, motivo: motivos.nombre, texto: calls.motivoPerdida })
    .from(calls)
    .leftJoin(motivos, eq(motivos.id, calls.motivoId))
    .where(and(inArray(calls.id, [...ids]), eq(calls.resultado, "perdida"), vigente(calls)));
  for (const f of filas) if (f.motivo ?? f.texto) m.set(f.id, (f.motivo ?? f.texto) as string);
  return m;
}

/** Cada abono de la caja del día con la venta de la que viene (la fecha y el closer de esa venta). */
export async function desgloseDeCaja({ programId, dia }: { programId: string; dia: string }, db: Db = dbDeLaApp): Promise<AbonoDeCaja[]> {
  const abonosDelDia = await db
    .select({
      id: abonos.id, dealId: abonos.dealId, moneda: abonos.moneda, monto: abonos.monto, concepto: abonos.concepto,
      persona: leads.nombre,
      closerId: users.closerId, closerNombre: users.nombre, closerEmail: users.email,
    })
    .from(abonos)
    .innerJoin(deals, and(eq(deals.id, abonos.dealId), vigente(deals)))
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroCaja({ programId, rango: { desde: dia, hasta: dia }, claveCloser: null }, db), vigente(abonos)));
  const ids = [...new Set(abonosDelDia.map((a) => a.dealId))];
  const dias = new Map<string, string>();
  if (ids.length > 0) {
    const ventas = ventasConDiaEn(db, { desde: "2000-01-01", hasta: dia }).as("ventas_con_dia");
    const filas = await db.select({ dealId: ventas.dealId, dia: ventas.dia }).from(ventas)
      .where(and(inArray(ventas.dealId, ids), incluyendoAnulados(ventas)));
    for (const f of filas) dias.set(f.dealId, f.dia);
  }
  return abonosDelDia.map((a): AbonoDeCaja => {
    const venta = dias.get(a.dealId) ?? null;
    const origen = a.concepto === "adicional" ? "adicional" : venta === dia ? "venta_nueva" : "saldo_anterior";
    return {
      id: a.id,
      persona: a.persona,
      moneda: a.moneda,
      monto: Number(a.monto),
      origen,
      ventaDelDia: origen === "saldo_anterior" ? venta : null,
      closerDeLaVenta: origen === "saldo_anterior"
        ? etiquetaDeCloser({ closerId: a.closerId, nombre: a.closerNombre, email: a.closerEmail })
        : null,
    };
  }).sort((a, b) => a.moneda.localeCompare(b.moneda) || (a.persona ?? "").localeCompare(b.persona ?? "", "es"));
}

/** La semana (lunes a viernes) del día del reporte, hasta ese día: la misma de la línea de contexto y de sus listas. */
export function rangoDeLaSemanaDelReporte(dia: string): { desde: string; hasta: string } {
  const numeroDeDia = diaDeLaSemana(dia);
  return { desde: sumarDias(dia, numeroDeDia === 0 ? -6 : 1 - numeroDeDia), hasta: dia };
}

/**
 * Un día entero del reporte para UN programa. `dia` es de Bogotá; un día futuro lo rechaza el llamador
 * (`resolverDiaDelReporte`), aquí se asume válido.
 */
export async function armarReporteDiario(
  { programId, dia, ventanaRitmo, contexto }: { programId: string; dia: string; ventanaRitmo?: VentanaRitmo; contexto?: ContextoDeVista | Promise<ContextoDeVista> },
  db: Db = dbDeLaApp,
) {
  const base = await armarVistaDeHoy({ programId, dia, ventanaRitmo, contexto }, db);
  const rangoDeLaSemana = rangoDeLaSemanaDelReporte(dia);
  const [filasDeVentas, caja, motivosPorLlamada, enviosPorArea, enviosDeLaSemana, showDeLaSemana] = await Promise.all([
    todasLasFilas("cierres", programId, dia, base.corte, db),
    desgloseDeCaja({ programId, dia }, db),
    motivosDeAgendas(db, base.agendaDeHoy.map((f) => f.id)),
    agruparEnvios(db, { programId, rango: { desde: dia, hasta: dia }, agruparPor: ["area"] }),
    agruparEnvios(db, { programId, rango: rangoDeLaSemana, agruparPor: [] }),
    showPorCitaDelRango({ programId, rango: rangoDeLaSemana, claveCloser: null }, base.corte, db),
  ]);
  const dealIds = filasDeVentas.map((f) => f.dealId).filter((id): id is string => id !== null);
  const shows = await diasConShowPorDeal(db, dealIds);
  const ventas: VentaDelReporte[] = filasDeVentas.map((f) => ({
    id: f.id,
    persona: f.persona?.nombre ?? null,
    closer: f.closer,
    vendido: f.monto ?? null,
    recaudado: f.recaudado ?? null,
    porCobrar: f.porCobrar ?? null,
    nacio: comoNacioLaVenta(dia, f.dealId ? shows.get(f.dealId) ?? [] : []),
  }));
  return {
    ...base,
    ventas,
    /** Registros de lunes al día del reporte (la semana de la plantilla). */
    leadsDeLaSemana: enviosDeLaSemana.reduce((t, f) => t + f.envios, 0),
    showDeLaSemana,
    /** Leads del día de pauta (área Paid, `resolverCanal`); el total es `registros`. */
    leadsDePauta: enviosPorArea.filter((f) => f.area === "paid").reduce((t, f) => t + f.envios, 0),
    detalleDeCaja: caja,
    resultados: resultadosPorCloser(base.agendaDeHoy.map((f) => ({ ...f, motivo: motivosPorLlamada.get(f.id) ?? null }))),
  };
}

export type ReporteDiario = Awaited<ReturnType<typeof armarReporteDiario>>;

/**
 * El día del reporte desde `?fecha=`: ausente = hoy; una fecha válida y no futura se respeta; una
 * futura o malformada devuelve `null` y la página responde "Fecha no válida" en vez de inventar cifras.
 */
export function resolverDiaDelReporte(valor: string | undefined, hoy: string = hoyEnBogota()): string | null {
  if (valor === undefined || valor === "") return hoy;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [a, m, d] = valor.split("-").map(Number);
  const real = new Date(Date.UTC(a, m - 1, d));
  if (real.getUTCFullYear() !== a || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return null;
  return valor > hoy ? null : valor;
}

/**
 * El "Total" de la vista de todos los programas (ADR 0048): SOLO conteos y caja por moneda. El tipo no
 * tiene un campo de tasa, así que un % de show o de cierre sumado entre programas no compila.
 */
export interface TotalDeConteos {
  registros: number;
  agendas: number;
  realizadas: number;
  ventas: number;
  caja: Array<{ moneda: string; total: number }>;
}

export function totalDeConteos(
  reportes: ReadonlyArray<{
    registros: number;
    ventas: readonly unknown[];
    caja: ReadonlyArray<{ moneda: string; total: number }>;
    vista: { embudo: { agendas: number; llamadasConShow: number } };
  }>,
): TotalDeConteos {
  const caja = new Map<string, number>();
  for (const r of reportes) for (const c of r.caja) caja.set(c.moneda, Math.round(((caja.get(c.moneda) ?? 0) + c.total) * 100) / 100);
  return {
    registros: reportes.reduce((t, r) => t + r.registros, 0),
    agendas: reportes.reduce((t, r) => t + r.vista.embudo.agendas, 0),
    realizadas: reportes.reduce((t, r) => t + r.vista.embudo.llamadasConShow, 0),
    ventas: reportes.reduce((t, r) => t + r.ventas.length, 0),
    caja: [...caja].map(([moneda, total]) => ({ moneda, total })).sort((a, b) => a.moneda.localeCompare(b.moneda)),
  };
}
