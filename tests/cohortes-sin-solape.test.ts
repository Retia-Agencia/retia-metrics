import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { crearCohorte, editarCohorte, type EntradaCohorte } from "@/lib/catalogo/cohortes";
import { META_LEADS_DIA_POR_DEFECTO } from "@/lib/cohortes-por-defecto";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 396 (M7, ADR 0125): dos cohortes de un programa no venden el mismo dia. La garantia es la
 * restriccion EXCLUDE de la base (0122), no el codigo; el catalogo solo traduce el choque a un 400.
 * Tambien cubre el valor inicial de la meta de leads por dia (0121 y el esquema).
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let actorId: string;
let programaA: string;
let programaB: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "sin-solape-a", nombre: "A" },
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "sin-solape-b", nombre: "B" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const [u] = await db.insert(users).values({ email: "g@example.test", rol: "gerente" }).returning();
  actorId = u.id;
});

function cohorte(programId: string, codigo: string, inicio: string | null, cierre: string | null): EntradaCohorte {
  return {
    programId, codigo, metaCupos: 10, precioUsd: "100", estado: "futuro",
    fechaInicioClases: null, fechaInicioVentas: inicio, fechaCierreVentas: cierre,
  };
}

describe("cohortes sin solape de ventas", () => {
  it("rechaza con un 400 una ventana que comparte un dia con otra del mismo programa", async () => {
    await crearCohorte(db, actorId, cohorte(programaA, "C1", "2026-11-01", "2026-11-20"));
    const e = await crearCohorte(db, actorId, cohorte(programaA, "C2", "2026-11-20", "2026-12-18")).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorDeApp);
    expect((e as ErrorDeApp).status).toBe(400);
    expect((e as ErrorDeApp).message).toContain("se solapan");
  });

  it("acepta ventanas contiguas, otro programa y cohortes sin fechas", async () => {
    await crearCohorte(db, actorId, cohorte(programaA, "C1", "2026-11-01", "2026-11-15"));
    await crearCohorte(db, actorId, cohorte(programaA, "C2", "2026-11-16", "2026-12-18"));
    await crearCohorte(db, actorId, cohorte(programaB, "C1", "2026-11-10", "2026-11-30"));
    await crearCohorte(db, actorId, cohorte(programaA, "C3", null, null));
    await crearCohorte(db, actorId, cohorte(programaA, "C4", null, null));
  });

  it("editar una ventana hacia otra cohorte tambien se rechaza", async () => {
    await crearCohorte(db, actorId, cohorte(programaA, "C1", "2026-11-01", "2026-11-15"));
    const c2 = await crearCohorte(db, actorId, cohorte(programaA, "C2", "2026-11-16", "2026-12-18"));
    const e = await editarCohorte(db, actorId, c2.id, cohorte(programaA, "C2", "2026-11-15", "2026-12-18")).catch((x) => x);
    expect(e).toBeInstanceOf(ErrorDeApp);
    expect((e as ErrorDeApp).message).toContain("se solapan");
  });
});

describe("meta de leads por dia por defecto", () => {
  it("una cohorte creada sin meta nace con el valor por defecto y la base lo respeta", async () => {
    const creada = await crearCohorte(db, actorId, cohorte(programaA, "C1", null, null));
    expect(creada.metaLeadsDia).toBe(META_LEADS_DIA_POR_DEFECTO);
    const [fila] = await db.insert((await import("@/lib/db/schema")).cohorts)
      .values({ programId: programaB, codigo: "X", metaCupos: 1, precioUsd: "1" }).returning();
    expect(fila.metaLeadsDia).toBe(META_LEADS_DIA_POR_DEFECTO);
  });

  it("una meta vacia explicita sigue siendo posible (se puede quitar)", async () => {
    const creada = await crearCohorte(db, actorId, { ...cohorte(programaA, "C1", null, null), metaLeadsDia: null });
    expect(creada.metaLeadsDia).toBeNull();
  });
});
