import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, cohorts, objetivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearSku, type EntradaSku } from "@/lib/catalogo/skus";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let actorId: string;
let programId: string;
let cicloAnteriorId: string;

const entrada = (cohorteN: number, inicio: string, cierre: string): EntradaSku => ({
  programId,
  nombre: "Virtual",
  cohorteN,
  precioListaUsd: "797.00",
  comisionPorcentaje: 10,
  cuentaComoCupo: true,
  ventana: { fechaInicioVentas: inicio, fechaCierreVentas: cierre, metaCupos: 30 },
});

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [actor] = await db.insert(users).values({
    email: "gerente-465@example.test",
    rol: "gerente",
    nombre: "Gerencia 465",
  }).returning();
  actorId = actor.id;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    nombre: "Tactical Investor",
    slug: "tactical-investor",
    ticketUsd: "797",
  }).returning();
  programId = programa.id;
  const anterior = await crearSku(db, actorId, entrada(3, "2026-10-01", "2026-10-31"));
  cicloAnteriorId = anterior.cohortId;
});

afterAll(async () => cerrar());

describe("ticket 465 — un ciclo nuevo hereda los umbrales del anterior (ADR 0141)", () => {
  it("copia costo_por_agenda con la misma meta, aceptable y moneda, y el umbral ya existe al nacer", async () => {
    await db.insert(objetivos).values([
      { cohortId: cicloAnteriorId, area: null, metrica: "costo_por_agenda", meta: "12.50", aceptable: "18.00", moneda: "USD" },
      { cohortId: cicloAnteriorId, area: "paid", metrica: "roas", meta: "3.00", aceptable: "2.00" },
    ]);

    const nuevo = await crearSku(db, actorId, entrada(4, "2027-01-01", "2027-01-31"));

    const filas = await objetivosDeCohortes(db, [nuevo.cohortId]);
    const costo = filas.find((f) => f.metrica === "costo_por_agenda" && f.area === null);
    expect(costo).toMatchObject({ meta: 12.5, aceptable: 18, moneda: "USD", activo: true });
    expect(filas.find((f) => f.metrica === "roas" && f.area === "paid")).toMatchObject({ meta: 3, aceptable: 2, moneda: null });
    expect(nuevo.herencia?.desde).toBe("C3");
    expect(nuevo.herencia?.metricas).toHaveLength(2);
  });

  it("si el ciclo anterior no tiene objetivos, el nuevo tampoco (sin umbral)", async () => {
    const nuevo = await crearSku(db, actorId, entrada(4, "2027-01-01", "2027-01-31"));

    expect(await objetivosDeCohortes(db, [nuevo.cohortId])).toEqual([]);
    expect(nuevo.herencia).toBeNull();
  });

  it("no copia cupos, agendas ni inversión", async () => {
    await db.insert(objetivos).values([
      { cohortId: cicloAnteriorId, area: null, metrica: "costo_por_venta", meta: "90.00", aceptable: "120.00", moneda: "USD" },
      { cohortId: cicloAnteriorId, area: "paid", metrica: "cupos", meta: "10.00" },
      { cohortId: cicloAnteriorId, area: null, metrica: "agendas", meta: "200.00" },
      { cohortId: cicloAnteriorId, area: null, metrica: "inversion", meta: "5000.00", moneda: "USD" },
    ]);

    const nuevo = await crearSku(db, actorId, entrada(4, "2027-01-01", "2027-01-31"));

    const filas = await db.select().from(objetivos).where(eq(objetivos.cohortId, nuevo.cohortId));
    expect(filas.map((f) => f.metrica)).toEqual(["costo_por_venta"]);
  });

  it("cada fila copiada deja su change_log con actor y 'heredado de C3'", async () => {
    await db.insert(objetivos).values({
      cohortId: cicloAnteriorId, area: null, metrica: "costo_por_agenda", meta: "12.50", aceptable: "18.00", moneda: "USD",
    });

    const nuevo = await crearSku(db, actorId, entrada(4, "2027-01-01", "2027-01-31"));

    const [copia] = await db.select().from(objetivos).where(eq(objetivos.cohortId, nuevo.cohortId));
    const rastro = await db.select().from(changeLog).where(
      and(eq(changeLog.tabla, "objetivos"), eq(changeLog.registroId, copia.id)),
    );
    expect(rastro.length).toBeGreaterThan(0);
    for (const fila of rastro) {
      expect(fila.userId).toBe(actorId);
      expect(fila.origen).toBe("app");
      expect(fila.etiqueta).toContain("heredado de C3");
    }
    expect(rastro.find((f) => f.campo === "meta")?.valorNuevo).toBe("12.50");
    const [ciclo] = await db.select().from(cohorts).where(eq(cohorts.id, nuevo.cohortId));
    expect(ciclo.codigo).toBe("C4");
  });
});
