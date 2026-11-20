import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@/lib/db/schema";
import { abonos, dealLineas, productos, skus } from "@/lib/db/schema";

const CARPETA_MIGRACIONES = fileURLToPath(new URL("../drizzle", import.meta.url));
const P1 = "00000000-0000-4000-8000-000000000001";
const P2 = "00000000-0000-4000-8000-000000000002";
const C1 = "00000000-0000-4000-8000-000000000011";
const C2 = "00000000-0000-4000-8000-000000000012";
const D_VENDIDO = "00000000-0000-4000-8000-000000000101";
const D_SIN_ABONOS = "00000000-0000-4000-8000-000000000102";
const D_ADICIONALES = "00000000-0000-4000-8000-000000000103";
const D_SIN_COHORTE = "00000000-0000-4000-8000-000000000104";
const D_ROSARIO = "00000000-0000-4000-8000-000000000105";
const USUARIO = "00000000-0000-4000-8000-000000000201";

let cliente: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

/** Posición de una migración en el journal: las de después (0155...) no corren antes de sembrar. */
function indiceDe(prefijo: string): number {
  const journal = JSON.parse(readFileSync(path.join(CARPETA_MIGRACIONES, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  const indice = journal.entries.findIndex((e) => e.tag.startsWith(prefijo));
  if (indice < 0) throw new Error(`No existe la migración ${prefijo}.`);
  return indice;
}

async function aplicarHasta0152(): Promise<void> {
  const migraciones = readMigrationFiles({ migrationsFolder: CARPETA_MIGRACIONES });
  for (const migracion of migraciones.slice(0, indiceDe("0153_"))) {
    await cliente.exec(migracion.sql.join("\n"));
  }
}

async function sembrarAntesDe0153(): Promise<void> {
  await cliente.exec(`
    INSERT INTO programs (id, slug, nombre, ticket_usd, comision_porcentaje) VALUES
      ('${P1}', 'tactical-investor', 'Tactical Investor', 1500, 10),
      ('${P2}', 'comunicarte', 'Comunicarte', 900, 8);
    INSERT INTO cohorts (id, program_id, codigo, meta_cupos, precio_usd) VALUES
      ('${C1}', '${P1}', 'C3', 20, 1500),
      ('${C2}', '${P2}', 'C7', 15, 900);
    INSERT INTO users (id, email, nombre, rol) VALUES
      ('${USUARIO}', 'developer@test.local', 'Developer', 'developer');
    INSERT INTO leads (id, program_id, email_normalizado, nombre, entrada) VALUES
      ('00000000-0000-4000-8000-000000000301', '${P1}', 'vendido@test.local', 'Vendido', 'crm'),
      ('00000000-0000-4000-8000-000000000302', '${P2}', 'vacio@test.local', 'Sin abonos', 'crm'),
      ('00000000-0000-4000-8000-000000000303', '${P1}', 'adicional@test.local', 'Adicional', 'crm'),
      ('00000000-0000-4000-8000-000000000304', '${P2}', 'sin-cohorte@test.local', 'Sin cohorte', 'crm'),
      ('00000000-0000-4000-8000-000000000305', '${P2}', 'rosario@test.local', 'Uno a uno', 'crm');
    INSERT INTO deals (id, lead_id, program_id, cohort_id, etapa, valor_vendido_usd, huella_migracion) VALUES
      ('${D_VENDIDO}', '00000000-0000-4000-8000-000000000301', '${P1}', '${C1}', 'ganado_parcial', 1200, '376-vendido'),
      ('${D_SIN_ABONOS}', '00000000-0000-4000-8000-000000000302', '${P2}', '${C2}', 'contactado', null, null),
      ('${D_ADICIONALES}', '00000000-0000-4000-8000-000000000303', '${P1}', '${C1}', 'contactado', null, null),
      ('${D_SIN_COHORTE}', '00000000-0000-4000-8000-000000000304', '${P2}', null, 'contactado', null, null),
      ('${D_ROSARIO}', '00000000-0000-4000-8000-000000000305', '${P2}', '${C2}', 'contactado', null, null);
    INSERT INTO abonos (id, deal_id, program_id, fecha, monto, moneda, concepto, nota) VALUES
      ('00000000-0000-4000-8000-000000000401', '${D_VENDIDO}', '${P1}', '2026-11-10', 500, 'USD', 'ticket', 'primero'),
      ('00000000-0000-4000-8000-000000000402', '${D_VENDIDO}', '${P1}', '2026-11-12', 700, 'USD', 'ticket', 'segundo'),
      ('00000000-0000-4000-8000-000000000403', '${D_ADICIONALES}', '${P1}', '2026-11-15', 100, 'USD', 'adicional', 'uno a uno'),
      ('00000000-0000-4000-8000-000000000404', '${D_ADICIONALES}', '${P1}', '2026-11-15', 200, 'USD', 'adicional', 'material'),
      ('00000000-0000-4000-8000-000000000405', '${D_ADICIONALES}', '${P1}', '2026-11-15', 300, 'USD', 'adicional', 'anulado'),
      ('00000000-0000-4000-8000-000000000406', '${D_ROSARIO}', '${P2}', '2026-11-11', 1431, 'USD', 'adicional', '1:1 con rosario');
    UPDATE abonos SET anulado_en = '2026-11-16T14:00:00Z', anulado_por = '${USUARIO}'
    WHERE id = '00000000-0000-4000-8000-000000000405';
  `);
}

async function aplicar0153(): Promise<void> {
  const migracion = readMigrationFiles({ migrationsFolder: CARPETA_MIGRACIONES })[indiceDe("0153_")];
  await cliente.transaction(async (tx) => {
    for (const sentencia of migracion.sql) await tx.exec(sentencia);
  });
}

async function aplicar0154(): Promise<void> {
  const migracion = readMigrationFiles({ migrationsFolder: CARPETA_MIGRACIONES })[indiceDe("0154_")];
  await cliente.transaction(async (tx) => {
    for (const sentencia of migracion.sql) await tx.exec(sentencia);
  });
}

async function aplicarDespuesDe0154(): Promise<void> {
  const migraciones = readMigrationFiles({ migrationsFolder: CARPETA_MIGRACIONES });
  for (const migracion of migraciones.slice(indiceDe("0154_") + 1)) {
    await cliente.exec(migracion.sql.join("\n"));
  }
}

beforeAll(async () => {
  cliente = new PGlite({ extensions: { btree_gist } });
  await aplicarHasta0152();
  await sembrarAntesDe0153();
  await aplicar0153();
  await aplicar0154();
  await aplicarDespuesDe0154();
  db = drizzle(cliente, { schema });
});

afterAll(async () => {
  await cliente.close();
});

describe("migracion 0153: productos, SKUs y lineas", () => {
  it("rellena catalogos, lineas y linea_id, incluidos tres adicionales del mismo dia", async () => {
    const productosCreados = await db.select().from(productos).orderBy(asc(productos.programId), asc(productos.slug));
    expect(productosCreados.map((p) => [p.programId, p.slug, p.nombre])).toEqual([
      [P1, "programa_virtual", "Programa virtual"],
      [P1, "sin_clasificar", "Sin clasificar"],
      [P2, "1_1_con_rosario", "1:1 con Rosario"],
      [P2, "programa_virtual", "Programa virtual"],
    ]);

    // Cupo y % de comision son del SKU: el virtual hereda el % del programa; el 1:1 y sin_clasificar, 0 y sin cupo.
    const skusCreados = await db.select().from(skus).orderBy(asc(skus.codigo));
    expect(skusCreados.map((s) => [s.codigo, s.precioListaUsd, s.cuentaComoCupo, s.comisionPorcentaje])).toEqual([
      ["comunicarte_1_1_con_rosario_c7", "1431.00", false, "0.00"],
      ["comunicarte_programa_virtual_c7", "900.00", true, "8.00"],
      ["tactical_investor_programa_virtual_c3", "1500.00", true, "10.00"],
      ["tactical_investor_sin_clasificar_c3", "0.00", false, "0.00"],
    ]);

    const lineas = await db.select().from(dealLineas);
    expect(lineas).toHaveLength(8);
    expect(lineas.filter((linea) => linea.dealId === D_ADICIONALES)).toHaveLength(4);

    const abonosCreados = await db.select().from(abonos).orderBy(asc(abonos.id));
    expect(abonosCreados.every((abono) => abono.lineaId !== null)).toBe(true);
    expect(abonosCreados[0].lineaId).toBe(abonosCreados[1].lineaId);
    expect(new Set(abonosCreados.slice(2, 5).map((abono) => abono.lineaId)).size).toBe(3);

    // El adicional de ComunicArte es el 1:1 con Rosario: su linea cuelga del SKU real, no de sin_clasificar.
    const rosario = abonosCreados.find((abono) => abono.dealId === D_ROSARIO)!;
    const lineaRosario = lineas.find((linea) => linea.id === rosario.lineaId)!;
    expect(lineaRosario.skuId).toBe(skusCreados.find((s) => s.codigo === "comunicarte_1_1_con_rosario_c7")!.id);
    expect(lineaRosario.valorVendidoUsd).toBe("1431.00");

    const adicionalAnulado = abonosCreados.find((abono) => abono.nota === "anulado")!;
    const lineaAnulada = lineas.find((linea) => linea.id === adicionalAnulado.lineaId)!;
    expect(lineaAnulada.anuladaEn?.toISOString()).toBe("2026-11-16T14:00:00.000Z");
    expect(lineaAnulada.anuladaPor).toBe(USUARIO);
    expect(lineaAnulada.valorVendidoUsd).toBe("300.00");
  });

  it("rechaza una linea con SKU de otro programa", async () => {
    const [skuAjeno] = await db.select().from(skus).where(eq(skus.programId, P2)).limit(1);
    await expect(
      db.insert(dealLineas).values({
        dealId: D_VENDIDO,
        programId: P1,
        skuId: skuAjeno.id,
        precioListaUsd: "900",
        valorVendidoUsd: "900",
      }),
    ).rejects.toThrow();
  });

  it("deja todos los abonos historicos con linea_id tras el backfill", async () => {
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(abonos).where(sql`${abonos.lineaId} IS NULL`);
    expect(Number(total)).toBe(0);
  });

  it("0154 rechaza linea_id NULL", async () => {
    await expect(cliente.exec(`
      INSERT INTO abonos (deal_id, program_id, fecha, monto, moneda, concepto)
      VALUES ('${D_VENDIDO}', '${P1}', '2026-11-18', 1, 'USD', 'ticket')
    `)).rejects.toThrow();
  });
});
