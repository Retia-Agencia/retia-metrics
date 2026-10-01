import { and, eq, inArray, sql } from "drizzle-orm";
import { abonos, deals, productos } from "@/lib/db/schema";
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
 * - **Precio:** el del producto del deal (ADR 0016, ADR 0037 punto 2).
 * - **Abonado:** la suma de sus abonos VIGENTES (ADR 0026).
 * - **Saldo:** precio menos abonado. Negativo es un sobrepago, no una deuda
 *   (`saldoLegible` en `lib/format.ts` decide como se escribe).
 *
 * ⚠️ **Nunca convertir moneda en silencio.** Si algun abono vigente esta en otra
 * moneda que el producto, el saldo no se puede calcular y sale `null` con la razon;
 * sumar USD con COP daria una cifra creible y falsa.
 */
export interface SaldoDeDeal {
  /** `null` si el deal no tiene producto: no hay precio contra el cual medir. */
  precio: number | null;
  moneda: string | null;
  abonado: number;
  abonosVigentes: number;
  /** `null` si no hay precio o si hay abonos en otra moneda. */
  saldo: number | null;
  /** Por que el saldo es `null`, cuando lo es. */
  sinSaldoPorque: "sin_producto" | "moneda_distinta" | null;
}

/** El saldo de varios deals de una vez, por id. Un deal que no existe no aparece. */
export async function saldosDeDeals(db: Db, dealIds: readonly string[]): Promise<Map<string, SaldoDeDeal>> {
  const resultado = new Map<string, SaldoDeDeal>();
  if (dealIds.length === 0) return resultado;

  // `incluyendoAnulados(deals)`: esto no es una metrica sobre deals, es el saldo de
  // deals que el llamador ya eligio por id. Si un deal anulado cuenta o no lo decide
  // quien llama.
  const precios = await db
    .select({ dealId: deals.id, precio: productos.precioLista, moneda: productos.moneda })
    .from(deals)
    .leftJoin(productos, eq(productos.id, deals.productoId))
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
    const monedaDistinta = p.moneda != null && suyas.some((s) => s.moneda !== p.moneda);

    const sinSaldoPorque = precio == null ? "sin_producto" : monedaDistinta ? "moneda_distinta" : null;
    resultado.set(p.dealId, {
      precio,
      moneda: p.moneda ?? null,
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
