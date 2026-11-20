import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { columnasCohorteConEstado, estadoDeCohorte, estadoDeCohorteSql } from "@/lib/cohortes/estado";
import * as catalogoCohortes from "@/lib/catalogo/cohortes";
import * as accionesPrograma from "@/app/(app)/p/[programa]/programa/acciones-programa";
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
    ticketUsd: "797",
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
      { codigo: "SIN", fechaInicioVentas: null, fechaCierreVentas: null },
      { codigo: "ANTES", fechaInicioVentas: "2026-11-21", fechaCierreVentas: "2026-11-30" },
      { codigo: "INICIO", fechaInicioVentas: hoy, fechaCierreVentas: "2026-11-25" },
      { codigo: "CIERRE", fechaInicioVentas: "2026-11-01", fechaCierreVentas: hoy },
      { codigo: "ABIERTO", fechaInicioVentas: "2026-11-01", fechaCierreVentas: null },
      { codigo: "CERRADO", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-19" },
    ] as const;
    await db.insert(cohorts).values(casos.map((caso) => ({
      programId,
      codigo: caso.codigo,
      metaCupos: 10,
      precioUsd: "797",
      fechaInicioVentas: caso.fechaInicioVentas,
      fechaCierreVentas: caso.fechaCierreVentas,
    })));

    const filas = await db.select({
      ...columnasCohorteConEstado(hoy),
      estadoSql: estadoDeCohorteSql(hoy),
    }).from(cohorts).where(eq(cohorts.programId, programId));
    for (const fila of filas) {
      expect(fila.estadoSql).toBe(estadoDeCohorte(fila, hoy));
      expect(fila.estado).toBe(fila.estadoSql);
    }
  });

  it("cohorteActiva sigue la ventana del dia de Bogota", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T04:30:00.000Z"));
    await db.insert(cohorts).values([
      { programId, codigo: "CERRADA", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-19" },
      { programId, codigo: "ACTIVA", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-20", fechaCierreVentas: "2026-11-20" },
      { programId, codigo: "FUTURA", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-21", fechaCierreVentas: null },
    ]);
    expect((await cohorteActiva(programId, db))?.codigo).toBe("ACTIVA");
  });

  it("no existe forma exportada de activar o cerrar a mano", () => {
    expect("activarCohorte" in catalogoCohortes).toBe(false);
    expect("desactivarCohorte" in catalogoCohortes).toBe(false);
    expect("activarCohorteAccion" in accionesPrograma).toBe(false);
    expect("desactivarCohorteAccion" in accionesPrograma).toBe(false);
  });

  it("0155 aplicada en PGlite deja cohorts sin estado y conserva el EXCLUDE", async () => {
    const columnas = await db.execute(sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'cohorts'`);
    expect(columnas.rows.map((fila) => fila.column_name)).not.toContain("estado");
    const restricciones = await db.execute(sql`select conname from pg_constraint where conrelid = 'cohorts'::regclass`);
    expect(restricciones.rows.map((fila) => fila.conname)).toContain("cohorts_sin_solape_de_ventas");
  });
});
