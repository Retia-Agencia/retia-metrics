import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { columnasCohorteConEstado, estadoDeCohorte, estadoDeCohorteSql } from "@/lib/cohortes/estado";
import * as catalogoCohortes from "@/lib/catalogo/cohortes";
import { readFileSync } from "node:fs";
import { cohorts, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { hoyEnBogota } from "@/lib/format";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  vi.useRealTimers();
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "cohorte-deducida",
    nombre: "Cohorte deducida",
  }).returning();
  programId = programa.id;
});

afterAll(async () => cerrar());

describe("376 B2 — estado deducido de la ventana", () => {
  it("mantiene paridad TS/SQL en todos los bordes, incluido 23:30 en Bogota", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T04:30:00.000Z"));
    const hoy = hoyEnBogota();
    expect(hoy).toBe("2026-11-20");

    const casos = [
      { codigo: "SIN", fechaInicioVentas: null, fechaCierreVentas: null, esperado: "futuro" },
      { codigo: "ANTES", fechaInicioVentas: "2026-11-21", fechaCierreVentas: "2026-11-30", esperado: "futuro" },
      { codigo: "INICIO", fechaInicioVentas: hoy, fechaCierreVentas: "2026-11-25", esperado: "activo" },
      { codigo: "CIERRE", fechaInicioVentas: "2026-11-01", fechaCierreVentas: hoy, esperado: "activo" },
      { codigo: "ABIERTO", fechaInicioVentas: "2026-11-01", fechaCierreVentas: null, esperado: "futuro" },
      { codigo: "CERRADO", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-19", esperado: "cerrado" },
    ] as const;
    // Un programa por caso: varias ventanas que contienen hoy chocarían con el EXCLUDE sin solape.
    for (const caso of casos) {
      const [programa] = await db.insert(programs).values({
        ...PROGRAMA_DE_PRUEBA,
        slug: `borde-${caso.codigo.toLowerCase()}`,
        nombre: `Borde ${caso.codigo}`,
      }).returning();
      await db.insert(cohorts).values({
        programId: programa.id,
        codigo: caso.codigo,
        metaCupos: 10,
        fechaInicioVentas: caso.fechaInicioVentas,
        fechaCierreVentas: caso.fechaCierreVentas,
      });
    }

    const filas = await db.select({
      ...columnasCohorteConEstado(hoy),
      estadoSql: estadoDeCohorteSql(hoy),
    }).from(cohorts);
    expect(filas).toHaveLength(casos.length);
    for (const fila of filas) {
      const caso = casos.find((c) => c.codigo === fila.codigo)!;
      expect(fila.estadoSql).toBe(caso.esperado);
      expect(estadoDeCohorte(fila, hoy)).toBe(caso.esperado);
      expect(fila.estado).toBe(fila.estadoSql);
    }
  });

  it("cohorteActiva sigue la ventana del dia de Bogota", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T04:30:00.000Z"));
    await db.insert(cohorts).values([
      { programId, codigo: "CERRADA", metaCupos: 10, fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-19" },
      { programId, codigo: "ACTIVA", metaCupos: 10, fechaInicioVentas: "2026-11-20", fechaCierreVentas: "2026-11-20" },
      { programId, codigo: "FUTURA", metaCupos: 10, fechaInicioVentas: "2026-11-21", fechaCierreVentas: null },
    ]);
    expect((await cohorteActiva(programId, db))?.codigo).toBe("ACTIVA");
  });

  it("no existe forma exportada de activar o cerrar a mano", () => {
    expect("activarCohorte" in catalogoCohortes).toBe(false);
    expect("desactivarCohorte" in catalogoCohortes).toBe(false);
    // Las acciones se leen como texto: importarlas arrastra next-auth fuera de Next.
    const acciones = readFileSync("app/(app)/p/[programa]/programa/acciones-programa.ts", "utf8");
    expect(acciones).not.toMatch(/export async function (des)?activarCohorteAccion/);
  });

  it("0155 aplicada en PGlite deja cohorts sin estado y conserva el EXCLUDE", async () => {
    const columnas = await db.execute(sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'cohorts'`);
    expect(columnas.rows.map((fila) => fila.column_name)).not.toContain("estado");
    const restricciones = await db.execute(sql`select conname from pg_constraint where conrelid = 'cohorts'::regclass`);
    expect(restricciones.rows.map((fila) => fila.conname)).toContain("cohorts_sin_solape_de_ventas");
  });
});
