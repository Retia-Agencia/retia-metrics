import { and, inArray, sql } from "drizzle-orm";
import { abonos, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

/**
 * Lo abonado y el saldo de un deal: UNA sola definicion (ADR 0024).
 *
 * Si dos lugares tienen que dar la misma cifra, la cifra vive aqui y los dos la
 * importan. Estuvo copiada en la reja del sobrepago y en la pantalla del closer, y
 * una pantalla y una reja discrepando sobre el mismo numero no se descubre hasta que
 * el dinero no cuadra. Salio con `sales` en la migracion 0020 y vuelve aqui sobre el
 * deal: hoy lo lee el motor de etapas (ticket 045); el 060 le suma la reja del abono.
 *
 * - **Precio:** el valor vendido del deal, escrito por el closer.
 * - **Abonado:** la suma de sus abonos VIGENTES (ADR 0026).
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

export interface DescuentoDeDeal {
  usd: number;
  /** Fracción del ticket: 0,125 representa 12,5 %. */
  porcentaje: number;
}

export interface ContratadoDeDeals {
  usd: number;
  sinValorVendido: number;
}

/** Valor contratado de ventas ya elegidas por id, sin convertir ni inventar montos. */
export async function contratadoDeDeals(db: Db, dealIds: readonly string[]): Promise<ContratadoDeDeals> {
  if (dealIds.length === 0) return { usd: 0, sinValorVendido: 0 };

  const filas = await db
    .select({ valorVendidoUsd: deals.valorVendidoUsd })
    .from(deals)
    .where(and(inArray(deals.id, [...dealIds]), vigente(deals)));

  return filas.reduce<ContratadoDeDeals>(
    (total, fila) => ({
      usd: total.usd + (fila.valorVendidoUsd == null ? 0 : Number(fila.valorVendidoUsd)),
      sinValorVendido: total.sinValorVendido + (fila.valorVendidoUsd == null ? 1 : 0),
    }),
    { usd: 0, sinValorVendido: 0 },
  );
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
  const resultado = new Map<string, SaldoDeDeal>();
  if (dealIds.length === 0) return resultado;

  // `incluyendoAnulados(deals)`: esto no es una metrica sobre deals, es el saldo de
  // deals que el llamador ya eligio por id. Si un deal anulado cuenta o no lo decide
  // quien llama.
  const precios = await db
    .select({ dealId: deals.id, precio: deals.valorVendidoUsd })
    .from(deals)
    .where(and(inArray(deals.id, [...dealIds]), incluyendoAnulados(deals)));

  const sumas = await db
    .select({
      dealId: abonos.dealId,
      moneda: abonos.moneda,
      total: sumaDeAbonos(),
      cuantos: sql<number>`count(*)::int`,
    })
    .from(abonos)
    .where(and(inArray(abonos.dealId, [...dealIds]), vigente(abonos)))
    .groupBy(abonos.dealId, abonos.moneda);

  for (const p of precios) {
    const suyas = sumas.filter((s) => s.dealId === p.dealId);
    const abonado = suyas.reduce((acc, s) => acc + Number(s.total), 0);
    const abonosVigentes = suyas.reduce((acc, s) => acc + Number(s.cuantos), 0);
    const precio = p.precio == null ? null : Number(p.precio);
    const moneda = "USD";
    const monedaDistinta = suyas.some((s) => s.moneda !== moneda);

    const sinSaldoPorque = precio == null ? "sin_valor_vendido" : monedaDistinta ? "moneda_distinta" : null;
    resultado.set(p.dealId, {
      precio,
      moneda,
      // Con monedas mezcladas, "abonado" tampoco es una cifra: se deja en 0 y el saldo en null.
      abonado: monedaDistinta ? 0 : abonado,
      abonosVigentes,
      saldo: sinSaldoPorque ? null : Math.round((precio! - abonado) * 100) / 100,
      sinSaldoPorque,
    });
  }
  return resultado;
}

/** Suma decimal de abonos: cada lector decide su alcance y agrupa siempre por moneda. */
export function sumaDeAbonos() {
  return sql<string>`sum(${abonos.monto})`;
}
