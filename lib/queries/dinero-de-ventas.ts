import type { Db } from "@/lib/db/tipos";
import { saldosDeDeals, type SaldoDeDeal } from "@/lib/queries/saldo";

/**
 * Las tres cifras del dinero de un conjunto de ventas (ticket 369, G-3 y DH-2 de `docs/hub.md` §0).
 *
 * - **Vendido:** Σ valor vendido (USD) de las ventas.
 * - **Recaudado:** Σ abonos de ticket vigentes de ESAS ventas, a hoy, sin importar cuándo se abonaron.
 * - **Por cobrar:** Vendido − Recaudado, venta por venta. Un saldo negativo es un sobrepago: no resta
 *   deuda a otra venta, se muestra aparte (`saldoLegible`).
 *
 * Las tres salen de `saldosDeDeals` (ADR 0024) sobre el MISMO conjunto de ids, así que cuadran al centavo:
 * `vendido = recaudado + porCobrar − sobrepago`. Una venta sin saldo calculable (sin valor vendido, o con
 * abonos en otra moneda) no entra a ninguna de las tres, para que el invariante se sostenga, y se cuenta
 * aparte en `sinSaldoCalculable`: nunca se convierte moneda en silencio.
 *
 * "Entró a caja" (abonos por la fecha del abono, de cualquier venta) es OTRA pregunta y otra función
 * (`cajaRecaudada`): ninguna de las dos se infiere de la otra (ADR 0013).
 */
export interface DineroDeVentas {
  vendido: number;
  recaudado: number;
  porCobrar: number;
  /** Lo abonado por encima del valor vendido, sumado venta por venta (positivo). */
  sobrepago: number;
  /** Ventas con las tres cifras calculadas. */
  ventas: number;
  /** Ventas que quedaron fuera de las tres por no tener saldo calculable. */
  sinSaldoCalculable: number;
  /** Ventas sin valor vendido: alarma de integridad incluida en `sinSaldoCalculable`. */
  sinValorVendido: number;
}

export const SIN_DINERO: DineroDeVentas = {
  vendido: 0, recaudado: 0, porCobrar: 0, sobrepago: 0, ventas: 0, sinSaldoCalculable: 0, sinValorVendido: 0,
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Suma pura de saldos ya calculados: la comparten el servidor y los tests del invariante. */
export function dineroDeSaldos(saldos: Iterable<SaldoDeDeal>): DineroDeVentas {
  const total = { ...SIN_DINERO };
  for (const s of saldos) {
    if (s.saldo === null || s.precio === null) {
      total.sinSaldoCalculable += 1;
      if (s.sinSaldoPorque === "sin_valor_vendido") total.sinValorVendido += 1;
      continue;
    }
    total.ventas += 1;
    total.vendido += s.precio;
    total.recaudado += s.abonado;
    if (s.saldo >= 0) total.porCobrar += s.saldo;
    else total.sobrepago += -s.saldo;
  }
  return {
    ...total,
    vendido: centavos(total.vendido),
    recaudado: centavos(total.recaudado),
    porCobrar: centavos(total.porCobrar),
    sobrepago: centavos(total.sobrepago),
  };
}

/** Las tres cifras de ventas ya elegidas por id (las que dejan pasar los filtros del Hub). */
export async function dineroDeVentas(db: Db, dealIds: readonly string[]): Promise<DineroDeVentas> {
  if (dealIds.length === 0) return { ...SIN_DINERO };
  return dineroDeSaldos((await saldosDeDeals(db, dealIds)).values());
}

/** Las tres cifras de UNA venta, para la columna de una lista. `null` si no tiene saldo calculable. */
export function dineroDeUnaVenta(saldo: SaldoDeDeal | undefined): { vendido: number; recaudado: number; porCobrar: number } | null {
  if (!saldo || saldo.saldo === null || saldo.precio === null) return null;
  return { vendido: saldo.precio, recaudado: saldo.abonado, porCobrar: Math.max(0, saldo.saldo) };
}

/**
 * Suma las tres cifras de varios programas (ADR 0048): las tres son USD y sumables, y la suma conserva el
 * invariante porque cada programa lo cumple por separado. Una tasa (el % recaudado) se calcula DESPUÉS, sobre el total.
 */
export function sumarDineroDeVentas(xs: readonly DineroDeVentas[]): DineroDeVentas {
  const total = xs.reduce<DineroDeVentas>((t, x) => ({
    vendido: t.vendido + x.vendido,
    recaudado: t.recaudado + x.recaudado,
    porCobrar: t.porCobrar + x.porCobrar,
    sobrepago: t.sobrepago + x.sobrepago,
    ventas: t.ventas + x.ventas,
    sinSaldoCalculable: t.sinSaldoCalculable + x.sinSaldoCalculable,
    sinValorVendido: t.sinValorVendido + x.sinValorVendido,
  }), { ...SIN_DINERO });
  return { ...total, vendido: centavos(total.vendido), recaudado: centavos(total.recaudado), porCobrar: centavos(total.porCobrar), sobrepago: centavos(total.sobrepago) };
}
