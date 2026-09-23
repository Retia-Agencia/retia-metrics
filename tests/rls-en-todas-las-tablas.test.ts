import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * ADR 0047 punto 5, migracion 0021: ninguna tabla de `public` queda sin RLS.
 *
 * Supabase publica esas tablas por REST a los roles `anon` y `authenticated`. RLS sin
 * politicas los deja sin filas. La 0021 lo activo en las 25 tablas que habia; una
 * tabla que traiga una migracion futura nace SIN RLS y sin que nada falle. Por eso
 * este guardian: corre todas las migraciones reales y exige RLS en todas.
 *
 * Si falla con una tabla nueva, la migracion que la crea tiene que llevar
 * `ALTER TABLE "<tabla>" ENABLE ROW LEVEL SECURITY;`.
 */

let db: Db;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
});

afterAll(async () => {
  await cerrar();
});

describe("RLS en todas las tablas (ADR 0047)", () => {
  it("toda tabla de public tiene RLS activo", async () => {
    const filas = (await db.execute(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    )) as unknown as { rows?: { tablename: string; rowsecurity: boolean }[] };
    const tablas = filas.rows ?? (filas as unknown as { tablename: string; rowsecurity: boolean }[]);

    expect(tablas.length).toBeGreaterThan(0);
    expect(tablas.filter((t) => !t.rowsecurity).map((t) => t.tablename)).toEqual([]);
  });

  it("la app sigue leyendo y escribiendo: RLS no aplica al dueno de las tablas", async () => {
    const filas = (await db.execute(sql`select count(*)::int as n from motivos`)) as unknown as {
      rows?: { n: number }[];
    };
    const [{ n }] = filas.rows ?? (filas as unknown as { n: number }[]);
    expect(n).toBeGreaterThan(0);
  });
});
