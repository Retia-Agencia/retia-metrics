import { and, between, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { emparejar } from "@/lib/atribucion/emparejar";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { calls, deals, gastoPauta, leads, pautaObjetos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import { arbolDePauta } from "@/lib/pauta/arbol";
import type { Rango } from "@/lib/queries/dashboard";
import { medianaDe, ubicacionesDeEscalera, ventasDelPrograma, type Escalon } from "@/lib/queries/escalera";
import { contratadoDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import { tasasDelRango } from "@/lib/trm/consultar";

export type NivelPauta = "campana" | "conjunto" | "anuncio" | "sin_anuncio" | "total";
export type PasoPauta = "registro" | "agenda" | "show" | "no_show" | "venta";

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
  dealId: string | null;
  etapa: string | null;
  campanaId: string | null;
  campanaNombre: string | null;
  conjuntoId: string | null;
  conjuntoNombre: string | null;
  anuncioId: string | null;
  anuncioNombre: string | null;
  citas: CitaDePauta[];
  venta: { dealId: string; etapa: string; dia: string; contratadoUsd: number; sinValorVendido: boolean; escalon: Escalon } | null;
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
  contratadoUsd: number;
  sinValorVendido: number;
  gastoUsd: number;
  desdeDias: number | null;
  hastaDias: number | null;
  madurando: boolean;
}

export interface VistaRoasDePauta {
  envios: FilaPorEnvioPauta[];
  total: RenglonRoas;
  campanas: RenglonRoas[];
  conjuntos: RenglonRoas[];
  anuncios: RenglonRoas[];
  sinAnuncio: RenglonRoas;
  ventanaCierreDias: number | null;
  sinHistorial: boolean;
  trmEtiqueta: string | null;
  diasSinTrm: string[];
}

const ocurrio = (resultado: string) => (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(resultado);

function diasEntre(desde: string, hasta: string): number {
  const partes = (v: string) => v.split("-").map(Number) as [number, number, number];
  const [ad, md, dd] = partes(desde);
  const [ah, mh, dh] = partes(hasta);
  return Math.max(0, Math.round((Date.UTC(ah, mh - 1, dh) - Date.UTC(ad, md - 1, dd)) / 86_400_000));
}

function renglonBase(nivel: NivelPauta, id: string | null, nombre: string, padreId: string | null): RenglonRoas {
  return { nivel, id, nombre, padreId, registros: 0, agendas: 0, shows: 0, noShows: 0, ventas: 0,
    ventasCompletas: 0, ventasParciales: 0, ventasEnLlamada: 0, ventasDespues: 0, ventasSinLlamada: 0,
    contratadoUsd: 0, sinValorVendido: 0, gastoUsd: 0,
    desdeDias: null, hastaDias: null, madurando: false };
}

function sumarEnvio(r: RenglonRoas, e: FilaPorEnvioPauta, hoy: string) {
  if (e.cuentaComoRegistro) r.registros++;
  r.agendas += e.citas.length;
  r.shows += e.citas.filter((c) => ocurrio(c.resultado)).length;
  r.noShows += e.citas.filter((c) => c.resultado === "no_show").length;
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
    r.contratadoUsd += e.venta.contratadoUsd;
    if (e.venta.sinValorVendido) r.sinValorVendido++;
  }
}

/** Carga el universo U una sola vez; la tarjeta agrega estas filas y la lista las filtra sin otra definición. */
export async function cargarRoasDePauta(db: Db, programId: string, rango: Rango, hoy: string): Promise<VistaRoasDePauta> {
  const [arbol, objetos, enviosCrudos, ventasPrograma, tasas, gastos] = await Promise.all([
    arbolDePauta(db, programId),
    db.select({ idMeta: pautaObjetos.idMeta, nombre: pautaObjetos.nombre, nivel: pautaObjetos.nivel,
      padreIdMeta: pautaObjetos.padreIdMeta }).from(pautaObjetos).where(eq(pautaObjetos.programId, programId)),
    db.select({ id: submissions.id, sourceId: submissions.sourceId, token: submissions.token,
      esParcial: submissions.esParcial, leadId: submissions.leadId, nombre: leads.nombre,
      fechaEnvio: submissions.fechaEnvio, ...columnasUtmDelEnvio })
      .from(submissions).innerJoin(sources, eq(sources.id, submissions.sourceId))
      .leftJoin(leads, and(eq(leads.id, submissions.leadId), eq(leads.programId, sources.programId)))
      .where(and(eq(sources.programId, programId),
        between(sql<string>`(${submissions.fechaEnvio} AT TIME ZONE 'America/Bogota')::date`, rango.desde, rango.hasta))),
    ventasDelPrograma(db, programId),
    tasasDelRango(db, rango.desde, rango.hasta),
    db.select({ fecha: gastoPauta.fecha, monto: gastoPauta.monto, moneda: gastoPauta.moneda,
      pautaObjetoId: gastoPauta.pautaObjetoId, area: gastoPauta.area, idMeta: pautaObjetos.idMeta })
      .from(gastoPauta).leftJoin(pautaObjetos, eq(pautaObjetos.id, gastoPauta.pautaObjetoId))
      .where(and(eq(gastoPauta.programId, programId), between(gastoPauta.fecha, rango.desde, rango.hasta),
        or(eq(gastoPauta.area, "paid"), isNotNull(gastoPauta.pautaObjetoId)))),
  ]);
  const nombres = new Map(objetos.map((o) => [o.idMeta, o.nombre]));
  const pagados = enviosCrudos.flatMap((e) => {
    if (e.fechaEnvio === null) return [];
    const traza = emparejar(utmsDelEnvio(e), arbol);
    if (traza.origen.area !== "paid") return [];
    return [{ envio: e, traza }];
  });
  const completosPorHuella = new Map(pagados.filter((e) => !e.envio.esParcial)
    .map((e) => [`${e.envio.sourceId}\u0000${e.envio.token}`, e]));
  const canonicos = new Map<string, FilaPorEnvioPauta>();
  const filaPorEnvioId = new Map<string, FilaPorEnvioPauta>();
  for (const { envio: e, traza } of pagados) {
    const completo = e.esParcial ? completosPorHuella.get(`${e.sourceId}\u0000${e.token}`) : undefined;
    const base = completo ?? { envio: e, traza };
    const idCanonico = base.envio.id;
    let fila = canonicos.get(idCanonico);
    if (!fila) {
      const anuncio = base.traza.anuncio;
      fila = { envioId: idCanonico, leadId: base.envio.leadId!, nombre: base.envio.nombre,
        fechaEnvio: base.envio.fechaEnvio!, diaEnvio: fechaDeInstanteEnBogota(base.envio.fechaEnvio!),
        cuentaComoRegistro: !base.envio.esParcial, canal: base.traza.origen.canal?.nombre ?? "Paid", dealId: null, etapa: null,
        campanaId: anuncio?.campanaId ?? null, campanaNombre: anuncio ? nombres.get(anuncio.campanaId) ?? anuncio.campanaId : null,
        conjuntoId: anuncio?.conjuntoId ?? null, conjuntoNombre: anuncio ? nombres.get(anuncio.conjuntoId) ?? anuncio.conjuntoId : null,
        anuncioId: anuncio?.anuncioId ?? null, anuncioNombre: anuncio ? nombres.get(anuncio.anuncioId) ?? anuncio.anuncioId : null,
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
  const diaVenta = new Map(ventasPrograma.map((v) => [v.dealId, diaDeCalendario(v.dia)]));
  const vendidos = dealsDelUniverso.filter((d) => diaVenta.has(d.id));
  const ubicaciones = await ubicacionesDeEscalera(db, {
    programId, dealIds: vendidos.map((d) => d.id), vendidos: new Set(vendidos.map((d) => d.id)),
  });
  const contratado = await contratadoDeDeals(db, vendidos.map((d) => d.id));
  const valores = vendidos.length === 0 ? [] : await db.select({ id: deals.id, valor: deals.valorVendidoUsd })
    .from(deals).where(and(inArray(deals.id, vendidos.map((d) => d.id)), vigente(deals)));
  const valorPorDeal = new Map(valores.map((v) => [v.id, v.valor]));
  for (const deal of vendidos) {
    const valor = valorPorDeal.get(deal.id);
    filaPorEnvioId.get(deal.submissionOrigenId!)!.venta = { dealId: deal.id, etapa: deal.etapa,
      dia: diaVenta.get(deal.id)!, contratadoUsd: valor == null ? 0 : Number(valor), sinValorVendido: valor == null,
      escalon: ubicaciones.porDeal.get(deal.id)!.escalon };
  }
  const todosVendidos = ventasPrograma.length;
  const origenesHistoricos = ventasPrograma.length === 0 ? [] : await db.select({
    dealId: deals.id, fechaEnvio: submissions.fechaEnvio,
  }).from(deals).leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(eq(deals.programId, programId), inArray(deals.id, ventasPrograma.map((v) => v.dealId)), vigente(deals)));
  const fechaOrigen = new Map(origenesHistoricos.map((f) => [f.dealId, f.fechaEnvio]));
  const diasCierre = ventasPrograma.flatMap((v) => {
    const origen = fechaOrigen.get(v.dealId);
    return origen ? [diasEntre(fechaDeInstanteEnBogota(origen), diaDeCalendario(v.dia))] : [];
  });
  const ventanaCierreDias = todosVendidos >= 5 ? medianaDe(diasCierre) : null;
  const total = renglonBase("total", null, "Total Paid", null);
  const sinAnuncio = renglonBase("sin_anuncio", null, "Sin anuncio", null);
  const campanas = new Map(objetos.filter((o) => o.nivel === "campana")
    .map((o) => [o.idMeta, renglonBase("campana", o.idMeta, o.nombre, null)]));
  const conjuntos = new Map(objetos.filter((o) => o.nivel === "conjunto")
    .map((o) => [o.idMeta, renglonBase("conjunto", o.idMeta, o.nombre, o.padreIdMeta)]));
  const anuncios = new Map(objetos.filter((o) => o.nivel === "anuncio")
    .map((o) => [o.idMeta, renglonBase("anuncio", o.idMeta, o.nombre, o.padreIdMeta)]));
  for (const e of universo) {
    sumarEnvio(total, e, hoy);
    if (!e.anuncioId) { sumarEnvio(sinAnuncio, e, hoy); continue; }
    const c = campanas.get(e.campanaId!) ?? renglonBase("campana", e.campanaId, e.campanaNombre!, null);
    const s = conjuntos.get(e.conjuntoId!) ?? renglonBase("conjunto", e.conjuntoId, e.conjuntoNombre!, e.campanaId);
    const a = anuncios.get(e.anuncioId) ?? renglonBase("anuncio", e.anuncioId, e.anuncioNombre!, e.conjuntoId);
    sumarEnvio(c, e, hoy); sumarEnvio(s, e, hoy); sumarEnvio(a, e, hoy);
    campanas.set(e.campanaId!, c); conjuntos.set(e.conjuntoId!, s); anuncios.set(e.anuncioId, a);
  }
  total.contratadoUsd = contratado.usd;
  total.sinValorVendido = contratado.sinValorVendido;
  const convertir = (monto: number, moneda: string, dia: string) => moneda === "USD" ? monto : moneda === "COP" ? (tasas.porDia.get(dia) ? monto / tasas.porDia.get(dia)! : 0) : 0;
  for (const g of gastos) {
    const usd = convertir(Number(g.monto), g.moneda, g.fecha);
    total.gastoUsd += usd;
    if (!g.idMeta) continue;
    const a = anuncios.get(g.idMeta); if (a) a.gastoUsd += usd;
    const arbolAnuncio = arbol.anuncios.find((x) => x.id === g.idMeta);
    if (arbolAnuncio) { const s = conjuntos.get(arbolAnuncio.conjuntoId); if (s) s.gastoUsd += usd;
      const c = campanas.get(arbolAnuncio.campanaId); if (c) c.gastoUsd += usd; }
  }
  const filas = [total, sinAnuncio, ...campanas.values(), ...conjuntos.values(), ...anuncios.values()];
  for (const r of filas) r.madurando = ventanaCierreDias !== null && r.desdeDias !== null && r.desdeDias < ventanaCierreDias;
  const diasSinTrm = [...new Set(gastos.filter((g) => g.moneda === "COP" && !tasas.porDia.has(g.fecha)).map((g) => g.fecha))].sort();
  const visible = (r: RenglonRoas) => r.registros > 0 || r.agendas > 0 || r.ventas > 0 || r.gastoUsd > 0;
  return { envios: universo, total, campanas: [...campanas.values()].filter(visible),
    conjuntos: [...conjuntos.values()].filter(visible), anuncios: [...anuncios.values()].filter(visible),
    sinAnuncio, ventanaCierreDias, sinHistorial: todosVendidos < 5, trmEtiqueta: tasas.etiqueta, diasSinTrm };
}

export function filtrarEnviosDePauta(envios: readonly FilaPorEnvioPauta[], nivel: NivelPauta, id?: string) {
  if (nivel === "total") return [...envios];
  if (nivel === "sin_anuncio") return envios.filter((e) => e.anuncioId === null);
  if (!id) return [];
  return envios.filter((e) => nivel === "campana" ? e.campanaId === id : nivel === "conjunto" ? e.conjuntoId === id : e.anuncioId === id);
}
