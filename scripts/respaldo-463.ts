import "./load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";

/**
 * Respaldo previo a la migración 0161 (ticket 463, ADR 0131). SOLO LECTURA: guarda en un JSON local, fuera del
 * repo, lo que la migración borra:
 *   - la tabla `productos` completa;
 *   - `skus.producto_id` (id del SKU y de su producto);
 *   - `programs.ticket_usd` y `programs.comision_porcentaje`;
 *   - `cohorts.precio_usd`;
 *   - `deals.comision_porcentaje` (solo los deals que lo tienen).
 * Las columnas se leen con SQL crudo porque el esquema de Drizzle ya no las declara.
 *
 * Uso: npx tsx scripts/respaldo-463.ts <ruta-del-archivo.json>   (la ruta debe quedar fuera del repo)
 * Se corre ANTES de aplicar la 0161. Si una columna ya no existe, falla sin escribir nada.
 */

type Filas = Record<string, unknown>[];

async function leer(consulta: ReturnType<typeof sql>): Promise<Filas> {
  const respuesta = await db.execute(consulta);
  return (Array.isArray(respuesta) ? respuesta : (respuesta as { rows: Filas }).rows) as Filas;
}

async function main(): Promise<void> {
  const destino = process.argv[2];
  if (!destino) throw new Error("Falta la ruta del JSON de salida: npx tsx scripts/respaldo-463.ts <ruta.json>");
  const absoluta = path.resolve(destino);
  const raiz = process.cwd();
  if (absoluta === raiz || absoluta.startsWith(raiz + path.sep)) {
    throw new Error("El respaldo debe guardarse fuera del repo (lleva datos de negocio).");
  }

  const productos = await leer(sql`SELECT * FROM "productos" ORDER BY "program_id", "slug"`);
  const skusConProducto = await leer(sql`SELECT "id", "program_id", "producto_id", "slug", "codigo" FROM "skus" ORDER BY "codigo"`);
  const programas = await leer(sql`SELECT "id", "slug", "ticket_usd", "comision_porcentaje" FROM "programs" ORDER BY "slug"`);
  const cohortes = await leer(sql`SELECT "id", "program_id", "codigo", "precio_usd" FROM "cohorts" ORDER BY "program_id", "codigo"`);
  const dealsConComision = await leer(sql`
    SELECT "id", "program_id", "etapa", "valor_vendido_usd", "comision_porcentaje"
    FROM "deals" WHERE "comision_porcentaje" IS NOT NULL ORDER BY "id"`);

  const respaldo = {
    ticket: "463",
    migracion: "0161_retiro_productos_463",
    generadoEn: new Date().toISOString(),
    conteos: {
      productos: productos.length,
      skus: skusConProducto.length,
      programas: programas.length,
      cohortes: cohortes.length,
      dealsConComision: dealsConComision.length,
    },
    productos,
    skusConProducto,
    programas,
    cohortes,
    dealsConComision,
  };

  mkdirSync(path.dirname(absoluta), { recursive: true });
  writeFileSync(absoluta, JSON.stringify(respaldo, null, 2), { mode: 0o600 });
  console.log(`Respaldo escrito en ${absoluta}`, respaldo.conteos);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("No se pudo escribir el respaldo 463:", error);
    process.exit(1);
  });
