import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { neon } from "@neondatabase/serverless";

/**
 * TEMPORAL — borrar este archivo despues de correrlo.
 *
 * Limpia los datos de PRUEBA que dejo el recorrido de Mani en `production` el
 * 18-sep, para que el equipo empiece con la base en cero (pedido suyo).
 *
 * No es un borrado generico: cada fila se identifica por su uuid exacto, leido de
 * la base antes de escribir este archivo. Un `delete ... where origen = 'app'`
 * habria sido mas corto y habria borrado tambien lo que el equipo registre de aqui
 * en adelante.
 *
 * **Por que se BORRA y no se anula**, si el ADR 0026 dice que un registro se anula:
 * anular existe para que una cifra equivocada del negocio siga siendo auditable.
 * Esto no es negocio equivocado, es una prueba de humo del dia del lanzamiento, y
 * dejarla anulada la deja para siempre en el historial de una persona que tampoco
 * existe. Mani lo pidio explicitamente. La excepcion es esta, no la regla.
 *
 * Simula por defecto. `npx tsx scripts/_limpiar-recorrido-prod.ts -- --escribir` aplica.
 */

/** Las filas exactas del recorrido del 18-sep. */
const ABONOS = ["7a0cf06f-d60f-4fe0-9dd4-e074880dfc2e"];
const VENTAS = ["efc7b5aa-67e7-4a3d-bfae-940adf441a22"];
const LLAMADAS = ["301ba369-afed-4abf-a28c-aa9e535575aa", "aea18436-379b-4aae-a016-bb3a83b37a6b"];
const PERSONAS = ["b50678ba-60e9-44b5-bda9-43bd2185536b"];
const RECURSOS = ["4758f011-cefd-495b-b60d-97d01bc15175"];

async function main() {
  const escribir = process.argv.includes("--escribir");
  const sql = neon(process.env.DB_PROD!);

  const rama = (await sql`select current_setting('neon.branch_id', true) as r`)[0] as { r: string };
  console.log(`\nRama: ${rama.r}${escribir ? "  ***ESCRIBIENDO***" : "  (simulacion)"}\n`);

  // Se mira lo que hay ANTES de borrar: si un id ya no esta, se dice, no se asume.
  const inventario = [
    ["abonos", ABONOS, await sql`select id, monto, moneda from abonos where id = any(${ABONOS})`],
    ["sales", VENTAS, await sql`select id, precio_aplicado_usd, closer_id from sales where id = any(${VENTAS})`],
    ["calls", LLAMADAS, await sql`select id, resultado, closer_id from calls where id = any(${LLAMADAS})`],
    ["people", PERSONAS, await sql`select id, email_normalizado, nombre, entrada from people where id = any(${PERSONAS})`],
    ["recursos", RECURSOS, await sql`select id, titulo, url from recursos where id = any(${RECURSOS})`],
  ] as const;

  for (const [tabla, ids, filas] of inventario) {
    console.log(`${tabla}: ${filas.length}/${ids.length} encontradas`);
    for (const f of filas) console.log("   ", JSON.stringify(f));
    if (filas.length !== ids.length) console.log(`    (faltan ${ids.length - filas.length}: ya no estaban)`);
  }

  // La bitacora de esas altas se va con ellas: si se queda, /nerd-stats muestra para
  // siempre "se creo la persona Thisa Test" apuntando a una fila que no existe, que
  // es peor que no tener el rastro. NO se toca el change_log de `users` ni el de
  // `miembros_programa`: esos son configuracion real que se queda.
  const ids = [...PERSONAS, ...RECURSOS];
  const bitacora = await sql`
    select count(*)::int n from change_log
    where origen = 'app' and tabla in ('people','recursos') and registro_id = any(${ids})`;
  console.log(`change_log (people, recursos) del recorrido: ${(bitacora[0] as { n: number }).n} filas`);

  if (!escribir) {
    console.log("\nSimulacion. Nada se escribio. Agrega -- --escribir para aplicar.\n");
    return;
  }

  // Orden obligado por las FK con `restrict`: un abono referencia su venta, y una
  // venta referencia la llamada que la cerro (ADR 0026 punto 2).
  console.log("\nBorrando...");
  console.log("  abonos   ", (await sql`delete from abonos where id = any(${ABONOS}) returning id`).length);
  console.log("  sales    ", (await sql`delete from sales where id = any(${VENTAS}) returning id`).length);
  console.log("  calls    ", (await sql`delete from calls where id = any(${LLAMADAS}) returning id`).length);
  console.log("  recursos ", (await sql`delete from recursos where id = any(${RECURSOS}) returning id`).length);
  console.log("  people   ", (await sql`delete from people where id = any(${PERSONAS}) returning id`).length);
  console.log(
    "  change_log",
    (await sql`delete from change_log where origen = 'app' and tabla in ('people','recursos') and registro_id = any(${ids}) returning id`).length,
  );

  const quedan = await sql`
    select 'calls' t, count(*)::int n from calls
    union all select 'sales', count(*) from sales
    union all select 'abonos', count(*) from abonos
    union all select 'recursos', count(*) from recursos
    union all select 'people entrada=crm', count(*) from people where entrada = 'crm'
    order by t`;
  console.log("\nDespues:");
  for (const q of quedan) console.log("  ", JSON.stringify(q));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fallo:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
