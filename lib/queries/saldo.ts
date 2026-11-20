import { and, eq, inArray, sql } from "drizzle-orm";
import { abonos, dealLineas, deals, productos, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { esLineaVendida } from "@/lib/deals/lineas";

/**
 * Lo abonado y el saldo de un deal: UNA sola definicion (ADR 0024).
 *
 * Si dos lugares tienen que dar la misma cifra, la cifra vive aqui y los dos la
 * importan. Estuvo copiada en la reja del sobrepago y en la pantalla del closer, y
 * una pantalla y una reja discrepando sobre el mismo numero no se descubre hasta que
 * el dinero no cuadra. Salio con `sales` en la migracion 0020 y vuelve aqui sobre el
 * deal: hoy lo lee el motor de etapas (ticket 045); el 060 le suma la reja del abono.
 *
 * - **Precio:** suma del valor vendido de las líneas vendidas vigentes.
 * - **Abonado:** suma de todos los abonos VIGENTES de esas líneas (ADR 0137 punto 14).
 * - **Saldo:** precio menos abonado. Negativo es un sobrepago, no una deuda
 *   (`saldoLegible` en `lib/format.ts` decide como se escribe).
 *
 * ⚠️ **Nunca convertir moneda en silencio.** Si algun abono vigente esta en otra
 * moneda que el valor vendido (USD), el saldo no se puede calcular y sale `null` con la razon;
 * sumar USD con COP daria una cifra creible y falsa.
 */
export interface SaldoDeDeal {
  /** `null` si el deal no tiene valor vendido: no hay precio contra el cual medir. */
  precio: number | null;
  moneda: string | null;
  abonado: number;
  abonosVigentes: number;
  /** `null` si no hay precio o si hay abonos en otra moneda. */
  saldo: number | null;
  /** Por que el saldo es `null`, cuando lo es. */
  sinSaldoPorque: "sin_valor_vendido" | "moneda_distinta" | null;
}

export interface SaldoDeLinea {
  lineaId: string;
  dealId: string;
  precio: number;
  moneda: string | null;
  abonado: number;
  abonosVigentes: number;
  saldo: number | null;
  sinSaldoPorque: "moneda_distinta" | null;
  vendida: boolean;
}

export interface DescuentoDeDeal {
  usd: number;
  /** Fracción del ticket: 0,125 representa 12,5 %. */
  porcentaje: number;
}

/** El valor vendido de cada deal elegido por id (`null` si no lo tiene): una sola lectura, sin convertir. */
export async function valoresVendidosDeDeals(db: Db, dealIds: readonly string[]): Promise<Map<string, number | null>> {
  if (dealIds.length === 0) return new Map();
  return unaVezPorSolicitud(db, claveDe("valoresVendidosDeDeals", dealIds), async () => {
    const filas = await db
      .select({ id: deals.id, valorVendidoUsd: deals.valorVendidoUsd })
      .from(deals)
      .where(and(inArray(deals.id, [...dealIds]), vigente(deals)));
    return new Map(filas.map((fila) => [fila.id, fila.valorVendidoUsd == null ? null : Number(fila.valorVendidoUsd)]));
  });
}

/** Descuento derivado del ticket de la cohorte y el total congelado del deal. */
export function descuentoDeDeal(
  ticketUsd: number | string | null | undefined,
  valorVendidoUsd: number | string | null | undefined,
): DescuentoDeDeal | null {
  if (ticketUsd == null || valorVendidoUsd == null) return null;
  const ticket = Number(ticketUsd);
  const valor = Number(valorVendidoUsd);
  if (!Number.isFinite(ticket) || ticket <= 0 || !Number.isFinite(valor)) return null;
  const descuento = Math.round((ticket - valor) * 100) / 100;
  return { usd: descuento, porcentaje: descuento / ticket };
}

/** El saldo de varios deals de una vez, por id. Un deal que no existe no aparece. */
export async function saldosDeDeals(db: Db, dealIds: readonly string[]): Promise<Map<string, SaldoDeDeal>> {
  if (dealIds.length === 0) return new Map();
  return unaVezPorSolicitud(db, claveDe("saldosDeDeals", dealIds), async () => {
    const [filasDeal, saldos] = await Promise.all([
      db.select({ id: deals.id, cortesia: deals.cortesia }).from(deals)
        .where(and(inArray(deals.id, [...dealIds]), incluyendoAnulados(deals))),
      saldosDeLineas(db, dealIds),
    ]);
    const resultado = new Map<string, SaldoDeDeal>();
    for (const deal of filasDeal) {
      // La cortesía conserva el contrato histórico de valor cero aunque no tenga
      // una línea vendida: cero es un valor conocido, no ausencia de valor.
      if (deal.cortesia) {
        resultado.set(deal.id, {
          precio: 0, moneda: "USD", abonado: 0, abonosVigentes: 0,
          saldo: 0, sinSaldoPorque: null,
        });
        continue;
      }
      const vendidas = [...saldos.values()].filter((linea) => linea.dealId === deal.id && linea.vendida);
      const precio = vendidas.length === 0 ? null : vendidas.reduce((total, linea) => total + linea.precio, 0);
      const monedaDistinta = vendidas.some((linea) => linea.sinSaldoPorque === "moneda_distinta");
      const abonado = monedaDistinta ? 0 : vendidas.reduce((total, linea) => total + linea.abonado, 0);
      const abonosVigentes = vendidas.reduce((total, linea) => total + linea.abonosVigentes, 0);
      const sinSaldoPorque = precio == null ? "sin_valor_vendido" : monedaDistinta ? "moneda_distinta" : null;
      resultado.set(deal.id, {
        precio, moneda: "USD", abonado, abonosVigentes,
        saldo: sinSaldoPorque ? null : Math.round((precio! - abonado) * 100) / 100,
        sinSaldoPorque,
      });
    }
    return resultado;
  });
}

/** Saldo de cada línea vigente de los deals elegidos, incluidas las propuestas. */
export async function saldosDeLineas(db: Db, dealIds: readonly string[]): Promise<Map<string, SaldoDeLinea>> {
  if (dealIds.length === 0) return new Map();
  return unaVezPorSolicitud(db, claveDe("saldosDeLineas", dealIds), async () => {
  const [lineas, sumas] = await Promise.all([
    db.select({
      lineaId: dealLineas.id, dealId: dealLineas.dealId, precio: dealLineas.valorVendidoUsd,
      etapa: deals.etapa, cortesia: deals.cortesia, cuentaComoCupo: skus.cuentaComoCupo,
    }).from(dealLineas)
      .innerJoin(deals, and(eq(deals.id, dealLineas.dealId), vigente(deals)))
      .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
      .innerJoin(productos, and(eq(productos.id, skus.productoId), eq(productos.programId, skus.programId)))
      .where(and(inArray(dealLineas.dealId, [...dealIds]), vigente(dealLineas))),
    db.select({
      lineaId: abonos.lineaId, moneda: abonos.moneda, total: sumaDeAbonos(),
      cuantos: sql<number>`count(*)::int`,
    }).from(abonos)
      .where(and(inArray(abonos.dealId, [...dealIds]), vigente(abonos)))
      .groupBy(abonos.lineaId, abonos.moneda),
  ]);
  const resultado = new Map<string, SaldoDeLinea>();
  const abonosPorDeal = new Map<string, number>();
  for (const linea of lineas) {
    const cuantos = sumas
      .filter((s) => s.lineaId === linea.lineaId)
      .reduce((total, s) => total + Number(s.cuantos), 0);
    abonosPorDeal.set(linea.dealId, (abonosPorDeal.get(linea.dealId) ?? 0) + cuantos);
  }
  for (const linea of lineas) {
    const suyas = sumas.filter((s) => s.lineaId === linea.lineaId);
    const monedaDistinta = suyas.some((s) => s.moneda !== "USD");
    const abonado = monedaDistinta ? 0 : suyas.reduce((total, s) => total + Number(s.total), 0);
    const abonosVigentes = suyas.reduce((total, s) => total + Number(s.cuantos), 0);
    const precio = Number(linea.precio);
    resultado.set(linea.lineaId, {
      lineaId: linea.lineaId, dealId: linea.dealId, precio, moneda: "USD", abonado, abonosVigentes,
      saldo: monedaDistinta ? null : Math.round((precio - abonado) * 100) / 100,
      sinSaldoPorque: monedaDistinta ? "moneda_distinta" : null,
      vendida: esLineaVendida({
        etapa: linea.etapa,
        cortesia: linea.cortesia,
        cuentaComoCupo: linea.cuentaComoCupo,
        abonosVigentes,
        abonosVigentesDelDeal: abonosPorDeal.get(linea.dealId) ?? 0,
      }),
    });
  }
  return resultado;
  });
}

/** Suma decimal de abonos: cada lector decide su alcance y agrupa siempre por moneda. */
export function sumaDeAbonos() {
  return sql<string>`sum(${abonos.monto})`;
}
