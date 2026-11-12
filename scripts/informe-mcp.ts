import "./load-env";
import { and, asc, gte, lt, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { mcpLlamadas } from "../lib/db/schema";

/**
 * Informe de solo lectura del MCP (ticket 411, F0 y línea base del F4): por herramienta, cuántas llamadas,
 * p50, p95 y máximo de duración en servidor, y cuántas fallaron por qué; con `--desde` y `--hasta` (ISO),
 * además la secuencia de esa ventana, llamada por llamada. Nunca escribe y no imprime usuarios ni tokens.
 *
 *   npx tsx scripts/informe-mcp.ts                 # últimos 7 días
 *   npx tsx scripts/informe-mcp.ts --dias 30
 *   npx tsx scripts/informe-mcp.ts --desde 2026-11-09T22:02:00Z --hasta 2026-11-09T22:04:00Z
 */
function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fecha(texto: string | undefined, nombre: string): Date | undefined {
  if (texto === undefined) return undefined;
  const valor = new Date(texto);
  if (Number.isNaN(valor.getTime())) throw new Error(`--${nombre} no es una fecha ISO: ${texto}`);
  return valor;
}

async function main() {
  const hasta = fecha(argumento("hasta"), "hasta") ?? new Date();
  const dias = Number(argumento("dias") ?? 7);
  const desde = fecha(argumento("desde"), "desde") ?? new Date(hasta.getTime() - dias * 86_400_000);
  const ventana = and(gte(mcpLlamadas.creadoEn, desde), lt(mcpLlamadas.creadoEn, hasta));

  const porHerramienta = await db
    .select({
      herramienta: mcpLlamadas.herramienta,
      llamadas: sql<number>`count(*)::int`,
      ok: sql<number>`count(*) filter (where ${mcpLlamadas.resultado} = 'ok')::int`,
      p50: sql<number | null>`percentile_cont(0.5) within group (order by ${mcpLlamadas.duracionMs})::int`,
      p95: sql<number | null>`percentile_cont(0.95) within group (order by ${mcpLlamadas.duracionMs})::int`,
      maximo: sql<number | null>`max(${mcpLlamadas.duracionMs})`,
    })
    .from(mcpLlamadas)
    .where(ventana)
    .groupBy(mcpLlamadas.herramienta)
    .orderBy(asc(mcpLlamadas.herramienta));

  const fallas = await db
    .select({
      herramienta: mcpLlamadas.herramienta,
      resultado: mcpLlamadas.resultado,
      codigo: mcpLlamadas.codigoError,
      veces: sql<number>`count(*)::int`,
    })
    .from(mcpLlamadas)
    .where(and(ventana, sql`${mcpLlamadas.resultado} <> 'ok'`))
    .groupBy(mcpLlamadas.herramienta, mcpLlamadas.resultado, mcpLlamadas.codigoError)
    .orderBy(asc(mcpLlamadas.herramienta));

  console.log(`MCP · ${desde.toISOString()} → ${hasta.toISOString()}`);
  console.table(porHerramienta);
  if (fallas.length > 0) console.table(fallas);

  if (argumento("desde") !== undefined) {
    const secuencia = await db
      .select({
        en: mcpLlamadas.creadoEn,
        herramienta: mcpLlamadas.herramienta,
        resultado: mcpLlamadas.resultado,
        codigo: mcpLlamadas.codigoError,
        ms: mcpLlamadas.duracionMs,
        cliente: mcpLlamadas.cliente,
      })
      .from(mcpLlamadas)
      .where(ventana)
      .orderBy(asc(mcpLlamadas.creadoEn));
    console.table(secuencia.map((f) => ({ ...f, en: f.en.toISOString() })));
    const suma = secuencia.reduce((total, f) => total + (f.ms ?? 0), 0);
    console.log(`${secuencia.length} llamadas, ${suma} ms en servidor.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
