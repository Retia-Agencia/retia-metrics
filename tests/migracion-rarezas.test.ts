import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { programs, rarezasMigracion } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { rarezasDelPrograma } from "@/lib/migracion/rarezas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 080 — la lista visible de rarezas. Un programa a la vez (ADR 0043), y un tipo que no
 * es de ese programa no deja la pantalla vacía.
 */

let db: Db;
let cerrar: () => Promise<void>;
let a: string;
let b: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [pa, pb] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "prog-a", nombre: "A", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "prog-b", nombre: "B", ticketUsd: "1000" },
    ])
    .returning();
  a = pa.id;
  b = pb.id;
  await db.insert(rarezasMigracion).values([
    { programId: a, huella: "sheets:prog-a:setteo:1", tipo: "sin_correo", detalle: "x" },
    { programId: a, huella: "sheets:prog-a:setteo:2", tipo: "sin_correo", detalle: "x" },
    { programId: a, huella: "sheets:prog-a:registro:3", tipo: "sin_fecha", detalle: "x" },
    { programId: b, huella: "sheets:prog-b:registro:4", tipo: "llamada_sin_deal", detalle: "x" },
  ]);
});

afterEach(async () => {
  await cerrar();
});

describe("rarezasDelPrograma", () => {
  it("cuenta por tipo y lista solo las del programa", async () => {
    const r = await rarezasDelPrograma(a, null, db);
    expect(r.porTipo).toEqual([
      { tipo: "sin_correo", total: 2 },
      { tipo: "sin_fecha", total: 1 },
    ]);
    expect(r.total).toBe(3);
    expect(r.filas.map((f) => f.huella).every((h) => h.startsWith("sheets:prog-a:"))).toBe(true);
  });

  it("filtra por tipo; un tipo de otro programa se ignora y trae todas", async () => {
    const soloFecha = await rarezasDelPrograma(a, "sin_fecha", db);
    expect(soloFecha.tipo).toBe("sin_fecha");
    expect(soloFecha.filas).toHaveLength(1);

    const ajeno = await rarezasDelPrograma(a, "llamada_sin_deal", db);
    expect(ajeno.tipo).toBeNull();
    expect(ajeno.filas).toHaveLength(3);
  });
});
