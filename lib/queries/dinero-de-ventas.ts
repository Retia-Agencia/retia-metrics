import type { Db } from "@/lib/db/tipos";
import { and, inArray } from "drizzle-orm";
import { deals } from "@/lib/db/schema";
import { saldosDeLineas, type SaldoDeDeal, type SaldoDeLinea } from "@/lib/queries/saldo";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * Las tres cifras del dinero de un conjunto de ventas (ticket 369, G-3 y DH-2 de `docs/hub.md` §0).
 *
 * - **Vendido:** Σ valor vendido (USD) de las ventas.
 * - **Recaudado:** Σ abonos de ticket vigentes de ESAS ventas, a hoy, sin importar cuándo se abonaron.
 * - **Por cobrar:** Vendido − Recaudado, venta por venta. Un saldo negativo es un sobrepago: no resta
 *   deuda a otra venta, se muestra aparte (`saldoLegible`).
 *
 * Las tres salen de `saldosDeLineas` (ADR 0024 y 0137, por línea vendida) sobre el MISMO conjunto de ids, así que cuadran al centavo:
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
  /** Líneas vendidas incluidas en las cifras. */
  lineas: number;
  /** Ventas que quedaron fuera de las tres por no tener saldo calculable. */
  sinSaldoCalculable: number;
  /** Ventas sin valor vendido: alarma de integridad incluida en `sinSaldoCalculable`. */
  sinValorVendido: number;
}

export const SIN_DINERO: DineroDeVentas = {
  vendido: 0, recaudado: 0, porCobrar: 0, sobrepago: 0, ventas: 0, lineas: 0,
  sinSaldoCalculable: 0, sinValorVendido: 0,
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Las tres cifras de ventas ya elegidas por id (las que dejan pasar los filtros del Hub). */
export async function dineroDeVentas(
  db: Db,
  dealIds: readonly string[],
  lineasElegidas?: readonly SaldoDeLinea[],
): Promise<DineroDeVentas> {
  if (dealIds.length === 0) return { ...SIN_DINERO };
  const ids = [...new Set(dealIds)];
  const [filasDeal, mapaDeLineas] = await Promise.all([
    db.select({ id: deals.id, cortesia: deals.cortesia }).from(deals)
      .where(and(inArray(deals.id, ids), incluyendoAnulados(deals))),
    lineasElegidas ? Promise.resolve(null) : saldosDeLineas(db, ids),
  ]);
  const lineas = lineasElegidas ?? [...mapaDeLineas!.values()].filter((linea) => linea.vendida);
  const porDeal = new Map<string, SaldoDeLinea[]>();
  for (const linea of lineas) {
    const grupo = porDeal.get(linea.dealId) ?? [];
    grupo.push(linea);
    porDeal.set(linea.dealId, grupo);
  }
  const total = { ...SIN_DINERO, lineas: lineas.length };
  for (const deal of filasDeal) {
    if (deal.cortesia) {
      total.ventas += 1;
      continue;
    }
    const suyas = porDeal.get(deal.id) ?? [];
    if (suyas.length === 0) {
      total.sinSaldoCalculable += 1;
      total.sinValorVendido += 1;
      continue;
    }
    let calculable = true;
    for (const linea of suyas) {
      total.vendido += linea.precio;
      if (linea.saldo === null) {
        calculable = false;
        continue;
      }
      total.recaudado += linea.abonado;
      if (linea.saldo >= 0) total.porCobrar += linea.saldo;
      else total.sobrepago += -linea.saldo;
    }
    if (calculable) total.ventas += 1;
    else total.sinSaldoCalculable += 1;
  }
  return {
    ...total,
    vendido: centavos(total.vendido), recaudado: centavos(total.recaudado),
    porCobrar: centavos(total.porCobrar), sobrepago: centavos(total.sobrepago),
  };
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
    lineas: t.lineas + x.lineas,
    sinSaldoCalculable: t.sinSaldoCalculable + x.sinSaldoCalculable,
    sinValorVendido: t.sinValorVendido + x.sinValorVendido,
  }), { ...SIN_DINERO });
  return { ...total, vendido: centavos(total.vendido), recaudado: centavos(total.recaudado), porCobrar: centavos(total.porCobrar), sobrepago: centavos(total.sobrepago) };
}
