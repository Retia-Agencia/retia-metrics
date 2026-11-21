import "./load-env";
import { db } from "../lib/db";
import { recolgarAbonos } from "../lib/deals/recolgar-abonos";
import { actorDelScript } from "./actor";

async function main() {
  const args = process.argv.slice(2);
  const aplicar = args.includes("--aplicar");
  const indiceSku = args.indexOf("--sku");
  const skuCodigo = indiceSku >= 0 ? args[indiceSku + 1] : undefined;
  if (indiceSku >= 0 && !skuCodigo) throw new Error("--sku exige el código del SKU destino.");
  const actorId = aplicar ? await actorDelScript(db) : undefined;
  const plan = await recolgarAbonos(db, {
    aplicar,
    skuCodigo,
    lineaVigenteMasAntigua: args.includes("--linea-vigente-mas-antigua"),
    actorId,
  });
  console.table(plan.map(({ deal, abono, de, a, motivo }) => ({ deal, abono, de, a: a ?? "—", motivo })));
  const movibles = plan.filter((fila) => fila.mover).length;
  console.log(aplicar ? `${movibles} abonos re-colgados.` : `Simulación: ${movibles} movimientos; no se escribió nada.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("No se pudo re-colgar abonos:", error);
  process.exit(1);
});
