import { and, between, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { emparejar } from "@/lib/atribucion/emparejar";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { razon, razonVacia, type RazonConCobertura } from "@/lib/cobertura";
import { calls, deals, leads, pautaObjetos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { citaPorVenirDeDealAbierto, citaSinResultado, noAsistio, ocurrio } from "@/lib/deals/resultados-de-llamada";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import { arbolDePauta } from "@/lib/pauta/arbol";
import { diaCubierto, motivoDeGasto, type CoberturaDeGasto } from "@/lib/pauta/cobertura-de-gasto";
import type { Rango } from "@/lib/queries/dashboard";
import { medianaDe, ubicacionesDeEscalera, ventasDelPrograma, type Escalon } from "@/lib/queries/escalera";
import { dineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import { gastoConvertido } from "@/lib/queries/hechos/gasto";
import { ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { valoresVendidosDeDeals } from "@/lib/queries/saldo";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { diaDeEnvio } from "@/lib/queries/hechos/fechas";

export const NIVELES_PAUTA = ["campana", "conjunto", "anuncio", "anuncio_sin_identificar", "sin_anuncio", "canal", "total"] as const;
export type NivelPauta = (typeof NIVELES_PAUTA)[number];
export const NIVEL_PAUTA_POR_DEFECTO: NivelPauta = "total";
export const PASOS_PAUTA = ["registro", "agenda", "show", "no_show", "venta"] as const;
export type PasoPauta = (typeof PASOS_PAUTA)[number];

export interface CitaDePauta {
  id: string;
  fecha: Date;
  resultado: string;
  dealId: string;
  etapa: string;
}

export interface FilaPorEnvioPauta {
  envioId: string;
  leadId: string;
  nombre: string | null;
  fechaEnvio: Date;
  diaEnvio: string;
  cuentaComoRegistro: boolean;
  canal: string;
  /** La clave estable del canal (`resolverCanal`), para agrupar y profundizar por canal. */
  canalClave: string;
  dealId: string | null;
  etapa: string | null;
  campanaId: string | null;
  campanaNombre: string | null;
  conjuntoId: string | null;
  conjuntoNombre: string | null;
  anuncioId: string | null;
  anuncioNombre: string | null;
  citas: CitaDePauta[];
  venta: { dealId: string; etapa: string; dia: string; valorVendidoUsd: number; sinValorVendido: boolean; escalon: Escalon } | null;
}

export interface RenglonRoas {
  nivel: NivelPauta;
  id: string | null;
  nombre: string;
  padreId: string | null;
  registros: number;
  agendas: number;
  shows: number;
  noShows: number;
  ventas: number;
  ventasCompletas: number;
  ventasParciales: number;
  ventasEnLlamada: number;
  ventasDespues: number;
  ventasSinLlamada: number;
  valorVendidoUsd: number;
  sinValorVendido: number;
  /** `null` = no disponible (Meta da el gasto por anuncio, no por canal): nunca un 0 inventado (N3). */
  gastoUsd: number | null;
  roas: RazonConCobertura;
  desdeDias: number | null;
  hastaDias: number | null;
}

export interface VistaRoasDePauta {
  envios: FilaPorEnvioPauta[];
  total: RenglonRoas;
  campanas: RenglonRoas[];
  conjuntos: RenglonRoas[];
  anuncios: RenglonRoas[];
  anunciosSinIdentificar: RenglonRoas[];
  sinAnuncio: RenglonRoas;
  /** El mismo universo agrupado por canal (par UTM, `resolverCanal`): la otra vista de la tabla. */
  canales: RenglonRoas[];
  cobertura: { anuncio: number; soloCampanaOConjunto: number; sinCampana: number };
  /**
   * Reconciliación con Hub/Comercial (ADR 0115 N3): las ventas del periodo por su FECHA (la definición
   * de venta de `ventasConDiaEn`) frente a las que el ROAS atribuye por cohorte. La diferencia son ventas
   * del periodo cuyo envío de origen no es pauta, o cuyo registro cayó en otro periodo: nunca se esconde.
   */
  reconciliacion: {
    ventasDelPeriodoPorFecha: number;
    atribuidasPorCohorteEnPeriodo: number;
    sinEnvioDePautaODeOtroPeriodo: number;
  };
  /**
   * Las citas de la cohorte del periodo que todavía no ocurrieron (agendadas y por venir): el ROAS puede
   * subir cuando se resuelvan (AJUSTE Daniel Tovar, 3-nov). Es un aviso de cobertura, no un bloqueo.
   */
  agendasPendientes: number;
  citasSinMarcar: number;
  ventanaCierreDias: number | null;
  ventasParaMadurez: number;
  trmEtiqueta: string | null;
  diasSinTrm: string[];
  coberturaGasto: CoberturaDeGasto;
  rango: Rango;
}


/** El día de negocio de un envío: el parcial no trae `fechaEnvio`, así que usa su creación. */
export function diaDelEnvio(envio: { fechaEnvio: Date | null; createdAt: Date }): string {
  return fechaDeInstanteEnBogota(envio.fechaEnvio ?? envio.createdAt);
}

const enRango = (dia: string, rango: Rango) => dia >= rango.desde && dia <= rango.hasta;

function diasEntre(desde: string, hasta: string): number {
  const partes = (v: string) => v.split("-").map(Number) as [number, number, number];
  const [ad, md, dd] = partes(desde);
  const [ah, mh, dh] = partes(hasta);
  return Math.max(0, Math.round((Date.UTC(ah, mh - 1, dh) - Date.UTC(ad, md - 1, dd)) / 86_400_000));
}

function renglonBase(nivel: NivelPauta, id: string | null, nombre: string, padreId: string | null): RenglonRoas {
  return { nivel, id, nombre, padreId, registros: 0, agendas: 0, shows: 0, noShows: 0, ventas: 0,
    ventasCompletas: 0, ventasParciales: 0, ventasEnLlamada: 0, ventasDespues: 0, ventasSinLlamada: 0,
    valorVendidoUsd: 0, sinValorVendido: 0, gastoUsd: 0, roas: { valor: null, base: 0, faltan: 0, motivo: null },
    desdeDias: null, hastaDias: null };
}

function sumarEnvio(r: RenglonRoas, e: FilaPorEnvioPauta, hoy: string) {
  if (e.cuentaComoRegistro) r.registros++;
  r.agendas += e.citas.length;
  r.shows += e.citas.filter((c) => ocurrio(c.resultado)).length;
  r.noShows += e.citas.filter((c) => noAsistio(c.resultado)).length;
  const dias = diasEntre(e.diaEnvio, hoy);
  r.desdeDias = r.desdeDias === null ? dias : Math.min(r.desdeDias, dias);
  r.hastaDias = r.hastaDias === null ? dias : Math.max(r.hastaDias, dias);
  if (e.venta) {
    r.ventas++;
    if (e.venta.etapa === "ganado_completo") r.ventasCompletas++;
    else r.ventasParciales++;
    if (e.venta.escalon === "pago_en_llamada") r.ventasEnLlamada++;
    else if (e.venta.escalon === "pago_rapido" || e.venta.escalon === "pago_despues") r.ventasDespues++;
    else r.ventasSinLlamada++;
    r.valorVendidoUsd += e.venta.valorVendidoUsd;
    if (e.venta.sinValorVendido) r.sinValorVendido++;
  }
}

export const MOTIVO_GASTO_POR_CANAL = "Meta da el gasto por anuncio, no por canal";

/** Las citas por venir de deals abiertos sin venta de estos envíos: la madurez de la cohorte (355). */
function pendientesDe(envios: readonly FilaPorEnvioPauta[], ahora: Date): number {
  return envios.reduce((n, e) => n + e.citas.filter((c) => citaPorVenirDeDealAbierto(
    c, { etapa: e.etapa, tieneVenta: e.venta !== null }, ahora)).length, 0);
}

function calcularRoas(r: RenglonRoas, envios: readonly FilaPorEnvioPauta[], cobertura: CoberturaDeGasto, ahora: Date) {
  if (r.gastoUsd === null) { r.roas = razonVacia(MOTIVO_GASTO_POR_CANAL); return; }
  const ventas = envios.filter((envio) => envio.venta !== null);
  const base = ventas.filter((envio) => diaCubierto(envio.diaEnvio, cobertura)).length;
  const faltan = ventas.length - base;
  r.roas = razon(r.valorVendidoUsd, r.gastoUsd, {
    base,
    faltan,
    calculable: faltan === 0,
    motivo: faltan > 0 ? motivoDeGasto(cobertura) : r.gastoUsd === 0 ? "Sin pauta" : null,
    agendasPendientes: pendientesDe(envios, ahora),
  });
}

/** Carga el universo U una sola vez; la tarjeta agrega estas filas y la lista las filtra sin otra definición. */
export async function cargarRoasDePauta(
  db: Db,
  programId: string,
  rango: Rango,
  hoy: string,
  ahora: Date = new Date(),
): Promise<VistaRoasDePauta> {
  const parcial = alias(submissions, "submission_parcial_roas");
  const completo = alias(submissions, "submission_completo_roas");
  const seleccionarEnvio = { id: submissions.id, sourceId: submissions.sourceId, token: submissions.token,
    esParcial: submissions.esParcial, leadId: submissions.leadId, nombre: leads.nombre,
    fechaEnvio: submissions.fechaEnvio, createdAt: submissions.createdAt, ...columnasUtmDelEnvio };
  const [arbol, objetos, enviosEnRango, parejas, ventasPrograma, gasto, ventasPorFecha] = await Promise.all([
    arbolDePauta(db, programId),
    db.select({ idMeta: pautaObjetos.idMeta, nombre: pautaObjetos.nombre, nivel: pautaObjetos.nivel,
      padreIdMeta: pautaObjetos.padreIdMeta }).from(pautaObjetos).where(eq(pautaObjetos.programId, programId)),
    db.select(seleccionarEnvio)
      .from(submissions).innerJoin(sources, eq(sources.id, submissions.sourceId))
      .leftJoin(leads, and(eq(leads.id, submissions.leadId), eq(leads.programId, sources.programId)))
      .where(and(eq(sources.programId, programId),
        between(diaDeEnvio(submissions), rango.desde, rango.hasta))),
    db.select({ parcialId: parcial.id, completoId: completo.id })
      .from(parcial)
      .innerJoin(completo, and(eq(completo.sourceId, parcial.sourceId), eq(completo.token, parcial.token),
        eq(completo.esParcial, false)))
      .innerJoin(sources, eq(sources.id, parcial.sourceId))
      .where(and(eq(sources.programId, programId), eq(parcial.esParcial, true), or(
        between(diaDeEnvio(parcial), rango.desde, rango.hasta),
        between(diaDeEnvio(completo), rango.desde, rango.hasta),
      ))),
    ventasDelPrograma(db, programId),
    // El hecho de gasto convertido (355): una sola función convierte y mide su cobertura.
    gastoConvertido(db, programId, rango),
    // Las ventas del periodo por su FECHA (la definición de venta, `ventasConDiaEn`): el denominador de
    // la reconciliación con Hub/Comercial. Se envuelve el derivado para aplicar `incluyendoAnulados` (la
    // vigencia ya se decidió dentro).
    (async () => {
      const dias = ventasConDiaEn(db, rango).as("ventas_por_fecha_roas");
      return db.select({ dealId: dias.dealId }).from(dias)
        .innerJoin(deals, and(eq(deals.id, dias.dealId), eq(deals.programId, programId), vigente(deals)))
        .where(incluyendoAnulados(dias));
    })(),
  ]);
  const coberturaGasto = gasto.cobertura;
  const idsCargados = new Set(enviosEnRango.map((e) => e.id));
  const idsExtra = [...new Set(parejas.flatMap((p) => [p.parcialId, p.completoId]))]
    .filter((id) => !idsCargados.has(id));
  const enviosExtra = idsExtra.length === 0 ? [] : await db.select(seleccionarEnvio)
    .from(submissions).innerJoin(sources, eq(sources.id, submissions.sourceId))
    .leftJoin(leads, and(eq(leads.id, submissions.leadId), eq(leads.programId, sources.programId)))
    .where(and(eq(sources.programId, programId), inArray(submissions.id, idsExtra)));
  const enviosCrudos = [...enviosEnRango, ...enviosExtra];
  const envioPorId = new Map(enviosCrudos.map((e) => [e.id, e]));
  const completoPorParcial = new Map(parejas.map((p) => [p.parcialId, p.completoId]));
  const nombres = new Map(objetos.map((o) => [o.idMeta, o.nombre]));
  const pagados = enviosCrudos.flatMap((e) => {
    const completoId = e.esParcial ? completoPorParcial.get(e.id) : undefined;
    const base = completoId ? envioPorId.get(completoId) : e;
    if (!base || !enRango(diaDelEnvio(base), rango)) return [];
    const traza = emparejar(utmsDelEnvio(base), arbol);
    if (traza.origen.area !== "paid") return [];
    return [{ envio: e, base, traza }];
  });
  const canonicos = new Map<string, FilaPorEnvioPauta>();
  const filaPorEnvioId = new Map<string, FilaPorEnvioPauta>();
  for (const { envio: e, base, traza } of pagados) {
    const idCanonico = base.id;
    let fila = canonicos.get(idCanonico);
    if (!fila) {
      const anuncio = traza.anuncio;
      const conjunto = traza.conjunto;
      const campanaId = traza.campana?.tipo === "meta" ? traza.campana.campanaId : null;
      const instante = base.fechaEnvio ?? base.createdAt;
      fila = { envioId: idCanonico, leadId: base.leadId!, nombre: base.nombre,
        fechaEnvio: instante, diaEnvio: diaDelEnvio(base),
        cuentaComoRegistro: !base.esParcial,
        canal: traza.origen.canal?.nombre ?? "Paid",
        canalClave: traza.origen.canal?.clave ?? "paid",
        dealId: null, etapa: null,
        campanaId, campanaNombre: campanaId ? nombres.get(campanaId) ?? campanaId : null,
        conjuntoId: conjunto?.conjuntoId ?? null,
        conjuntoNombre: conjunto ? nombres.get(conjunto.conjuntoId) ?? conjunto.conjuntoId : null,
        anuncioId: anuncio?.anuncioId ?? null,
        anuncioNombre: anuncio ? nombres.get(anuncio.anuncioId) ?? anuncio.anuncioId : null,
        citas: [], venta: null };
      canonicos.set(idCanonico, fila);
    }
    filaPorEnvioId.set(e.id, fila);
  }
  const universo = [...canonicos.values()];
  const idsEnvio = [...filaPorEnvioId.keys()];
  const dealsDelUniverso = idsEnvio.length === 0 ? [] : await db.select({ id: deals.id, submissionOrigenId: deals.submissionOrigenId,
    etapa: deals.etapa }).from(deals).where(and(eq(deals.programId, programId), eq(deals.cortesia, false),
      inArray(deals.submissionOrigenId, idsEnvio), vigente(deals)));
  const idsDeal = dealsDelUniverso.map((d) => d.id);
  for (const deal of dealsDelUniverso) {
    const envio = filaPorEnvioId.get(deal.submissionOrigenId!);
    if (envio && envio.dealId === null) { envio.dealId = deal.id; envio.etapa = deal.etapa; }
  }
  const citas = idsDeal.length === 0 ? [] : await db.select({ id: calls.id, dealId: calls.dealId,
    fechaAgenda: calls.fechaAgenda, fechaLlamada: calls.fechaLlamada, createdAt: calls.createdAt,
    resultado: calls.resultado }).from(calls).where(and(eq(calls.programId, programId), inArray(calls.dealId, idsDeal), vigente(calls)));
  const envioPorDeal = new Map(dealsDelUniverso.map((d) => [d.id, d.submissionOrigenId!]));
  const dealPorId = new Map(dealsDelUniverso.map((d) => [d.id, d]));
  for (const cita of citas) filaPorEnvioId.get(envioPorDeal.get(cita.dealId!)!)?.citas.push({
    id: cita.id, fecha: cita.fechaAgenda ?? cita.fechaLlamada ?? cita.createdAt, resultado: cita.resultado,
    dealId: cita.dealId!, etapa: dealPorId.get(cita.dealId!)!.etapa,
  });
  const citasSinMarcar = citas.filter((cita) => citaSinResultado(cita, ahora)).length;
  const diaVenta = new Map(ventasPrograma.map((v) => [v.dealId, diaDeCalendario(v.dia)]));
  const vendidos = dealsDelUniverso.filter((d) => diaVenta.has(d.id));
  const ubicaciones = await ubicacionesDeEscalera(db, {
    programId, dealIds: vendidos.map((d) => d.id), vendidos: new Set(vendidos.map((d) => d.id)),
  });
  const dinero = await dineroDeVentas(db, vendidos.map((d) => d.id));
  const valorPorDeal = await valoresVendidosDeDeals(db, vendidos.map((d) => d.id));
  for (const deal of vendidos) {
    const valor = valorPorDeal.get(deal.id);
    filaPorEnvioId.get(deal.submissionOrigenId!)!.venta = { dealId: deal.id, etapa: deal.etapa,
      dia: diaVenta.get(deal.id)!, valorVendidoUsd: valor ?? 0, sinValorVendido: valor == null,
      escalon: ubicaciones.porDeal.get(deal.id)!.escalon };
  }
  const origenesHistoricos = ventasPrograma.length === 0 ? [] : await db.select({
    dealId: deals.id, envioId: submissions.id, fechaEnvio: submissions.fechaEnvio, createdAt: submissions.createdAt,
  }).from(deals).leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(eq(deals.programId, programId), inArray(deals.id, ventasPrograma.map((v) => v.dealId)), vigente(deals)));
  const fechaOrigen = new Map(origenesHistoricos.map((f) => [f.dealId, f]));
  const diasCierre = ventasPrograma.flatMap((v) => {
    const origen = fechaOrigen.get(v.dealId);
    return origen?.envioId && origen.createdAt
      ? [diasEntre(diaDelEnvio({ fechaEnvio: origen.fechaEnvio, createdAt: origen.createdAt }), diaDeCalendario(v.dia))]
      : [];
  });
  const ventanaCierreDias = diasCierre.length >= 5 ? medianaDe(diasCierre) : null;
  const total = renglonBase("total", null, "Total Paid", null);
  const sinAnuncio = renglonBase("sin_anuncio", null, "Sin campaña de Meta", null);
  const campanas = new Map(objetos.filter((o) => o.nivel === "campana")
    .map((o) => [o.idMeta, renglonBase("campana", o.idMeta, o.nombre, null)]));
  const conjuntos = new Map(objetos.filter((o) => o.nivel === "conjunto")
    .map((o) => [o.idMeta, renglonBase("conjunto", o.idMeta, o.nombre, o.padreIdMeta)]));
  const anuncios = new Map(objetos.filter((o) => o.nivel === "anuncio")
    .map((o) => [o.idMeta, renglonBase("anuncio", o.idMeta, o.nombre, o.padreIdMeta)]));
  const anunciosSinIdentificar = new Map<string, RenglonRoas>();
  for (const e of universo) {
    sumarEnvio(total, e, hoy);
    if (!e.campanaId) { sumarEnvio(sinAnuncio, e, hoy); continue; }
    const c = campanas.get(e.campanaId!) ?? renglonBase("campana", e.campanaId, e.campanaNombre!, null);
    sumarEnvio(c, e, hoy); campanas.set(e.campanaId, c);
    if (e.conjuntoId) {
      const s = conjuntos.get(e.conjuntoId) ?? renglonBase("conjunto", e.conjuntoId, e.conjuntoNombre!, e.campanaId);
      sumarEnvio(s, e, hoy); conjuntos.set(e.conjuntoId, s);
    }
    if (e.anuncioId) {
      const a = anuncios.get(e.anuncioId) ?? renglonBase("anuncio", e.anuncioId, e.anuncioNombre!, e.conjuntoId);
      sumarEnvio(a, e, hoy); anuncios.set(e.anuncioId, a);
    } else {
      const residual = anunciosSinIdentificar.get(e.campanaId)
        ?? renglonBase("anuncio_sin_identificar", e.campanaId, "Anuncio sin identificar", e.campanaId);
      sumarEnvio(residual, e, hoy); anunciosSinIdentificar.set(e.campanaId, residual);
    }
  }
  total.valorVendidoUsd = dinero.vendido;
  total.sinValorVendido = dinero.sinValorVendido;
  // El gasto convertido ya vive en el hecho (355): aquí solo se reparte por la jerarquía de Meta.
  total.gastoUsd = gasto.totalUsd;
  for (const [idMeta, usd] of gasto.porAnuncio) {
    const a = anuncios.get(idMeta); if (a) a.gastoUsd = (a.gastoUsd ?? 0) + usd;
    const arbolAnuncio = arbol.anuncios.find((x) => x.id === idMeta);
    if (arbolAnuncio) { const s = conjuntos.get(arbolAnuncio.conjuntoId); if (s) s.gastoUsd = (s.gastoUsd ?? 0) + usd;
      const c = campanas.get(arbolAnuncio.campanaId); if (c) c.gastoUsd = (c.gastoUsd ?? 0) + usd; }
  }
  // El mismo universo agrupado por canal (par UTM): la otra vista de la tabla. El gasto por canal
  // no se puede repartir (Meta lo da por anuncio, no por par UTM), así que su ROAS no aplica: la
  // columna Gasto/ROAS de canal queda en 0/—, con la misma cobertura.
  const canalesMap = new Map<string, RenglonRoas>();
  for (const e of universo) {
    const fila = canalesMap.get(e.canalClave) ?? { ...renglonBase("canal", e.canalClave, e.canal, null), gastoUsd: null };
    sumarEnvio(fila, e, hoy); canalesMap.set(e.canalClave, fila);
  }
  const para = (predicado: (envio: FilaPorEnvioPauta) => boolean) => universo.filter(predicado);
  calcularRoas(total, universo, coberturaGasto, ahora);
  calcularRoas(sinAnuncio, para((e) => e.campanaId === null), coberturaGasto, ahora);
  for (const fila of campanas.values()) calcularRoas(fila, para((e) => e.campanaId === fila.id), coberturaGasto, ahora);
  for (const fila of conjuntos.values()) calcularRoas(fila, para((e) => e.conjuntoId === fila.id), coberturaGasto, ahora);
  for (const fila of anuncios.values()) calcularRoas(fila, para((e) => e.anuncioId === fila.id), coberturaGasto, ahora);
  for (const fila of anunciosSinIdentificar.values()) {
    calcularRoas(fila, para((e) => e.campanaId === fila.id && e.anuncioId === null), coberturaGasto, ahora);
  }
  for (const fila of canalesMap.values()) calcularRoas(fila, para((e) => e.canalClave === fila.id), coberturaGasto, ahora);
  const visible = (r: RenglonRoas) => r.registros > 0 || r.agendas > 0 || r.ventas > 0 || (r.gastoUsd ?? 0) > 0;
  const registros = universo.filter((e) => e.cuentaComoRegistro);
  const cobertura = {
    anuncio: registros.filter((e) => e.anuncioId !== null).length,
    soloCampanaOConjunto: registros.filter((e) => e.campanaId !== null && e.anuncioId === null).length,
    sinCampana: registros.filter((e) => e.campanaId === null).length,
  };
  // Reconciliación con Hub/Comercial: las ventas del periodo por su fecha, menos las que el ROAS
  // atribuye por cohorte y además caen en el periodo por su fecha. La diferencia son ventas sin
  // envío de pauta de origen, o de registros de otro periodo. Nunca se esconde (ADR 0115 N3).
  const ventasDelPeriodoPorFecha = new Set(ventasPorFecha.map((v) => v.dealId));
  const atribuidasEnPeriodo = universo.filter((e) => e.venta && ventasDelPeriodoPorFecha.has(e.venta.dealId)).length;
  const reconciliacion = {
    ventasDelPeriodoPorFecha: ventasDelPeriodoPorFecha.size,
    atribuidasPorCohorteEnPeriodo: atribuidasEnPeriodo,
    sinEnvioDePautaODeOtroPeriodo: Math.max(0, ventasDelPeriodoPorFecha.size - atribuidasEnPeriodo),
  };
  // Las citas de la cohorte todavía por ocurrir (agendadas, su hora aún no llega, de deals abiertos sin venta):
  // el ROAS puede subir cuando se resuelvan (AJUSTE 3-nov). No es un no show ni un dato que falta.
  const agendasPendientes = pendientesDe(universo, ahora);
  return { envios: universo, total, campanas: [...campanas.values()].filter(visible),
    conjuntos: [...conjuntos.values()].filter(visible), anuncios: [...anuncios.values()].filter(visible),
    anunciosSinIdentificar: [...anunciosSinIdentificar.values()].filter(visible), sinAnuncio,
    canales: [...canalesMap.values()].filter(visible), cobertura, reconciliacion, agendasPendientes, citasSinMarcar,
    ventanaCierreDias, ventasParaMadurez: diasCierre.length,
    trmEtiqueta: gasto.trmEtiqueta, diasSinTrm: gasto.diasSinTrm, coberturaGasto, rango };
}

export function filtrarEnviosDePauta(envios: readonly FilaPorEnvioPauta[], nivel: NivelPauta, id?: string) {
  if (nivel === "total") return [...envios];
  if (nivel === "sin_anuncio") return envios.filter((e) => e.campanaId === null);
  if (!id) return [];
  if (nivel === "anuncio_sin_identificar") return envios.filter((e) => e.campanaId === id && e.anuncioId === null);
  if (nivel === "canal") return envios.filter((e) => e.canalClave === id);
  return envios.filter((e) => nivel === "campana" ? e.campanaId === id : nivel === "conjunto" ? e.conjuntoId === id : e.anuncioId === id);
}

/** Resuelve exactamente una fila de la jerarquía visible de ROAS. */
export function renglonRoasDeVista(vista: VistaRoasDePauta, nivel: NivelPauta, id?: string): RenglonRoas | null {
  if (nivel === "total") return id === undefined ? vista.total : null;
  if (nivel === "sin_anuncio") return id === undefined ? vista.sinAnuncio : null;
  if (!id) return null;
  if (nivel === "campana") return vista.campanas.find((fila) => fila.id === id) ?? null;
  if (nivel === "conjunto") return vista.conjuntos.find((fila) => fila.id === id) ?? null;
  if (nivel === "anuncio") return vista.anuncios.find((fila) => fila.id === id) ?? null;
  if (nivel === "anuncio_sin_identificar") {
    return vista.anunciosSinIdentificar.find((fila) => fila.id === id) ?? null;
  }
  if (nivel === "canal") return vista.canales.find((fila) => fila.id === id) ?? null;
  const exhaustivo: never = nivel;
  return exhaustivo;
}
