import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { columnasCohorteConEstado, estadoDeCohorte, estadoDeCohorteSql } from "@/lib/cohortes/estado";
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

/**
 * El estado de una cohorte (futuro, activo, cerrado) se deduce de su ventana de ventas y nadie lo fija a mano
 * (ticket 376 B2). Por que es de base: la paridad entre `estadoDeCohorte` (TS) y `estadoDeCohorteSql` solo se
 * ve ejecutando el SQL, y `cohorteActiva` lee la ventana de la tabla. Que la columna `estado` no exista la
 * guarda `esquema-cohorte.test.ts`; el EXCLUDE sin solape, `cohortes-sin-solape.test.ts`.
 */
describe("estado deducido de la ventana de la cohorte", () => {
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
        ticketUsd: "797",
      }).returning();
      await db.insert(cohorts).values({
        programId: programa.id,
        codigo: caso.codigo,
        metaCupos: 10,
        precioUsd: "797",
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
      { programId, codigo: "CERRADA", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-19" },
      { programId, codigo: "ACTIVA", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-20", fechaCierreVentas: "2026-11-20" },
      { programId, codigo: "FUTURA", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-21", fechaCierreVentas: null },
    ]);
    expect((await cohorteActiva(programId, db))?.codigo).toBe("ACTIVA");
  });
});
