import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { areas, canales, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { paresSinClasificar } from "@/lib/atribucion/pares-sin-clasificar";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => ({ db, cerrar } = await crearBaseDePrueba()));
afterEach(async () => cerrar());

describe("pares sin clasificar (ticket 101)", () => {
  it("cuenta completos por programa, normaliza el par y excluye resueltos", async () => {
    const [actor] = await db.insert(users).values({ email: "pares@retia.local", rol: "gerente" }).returning();
    const [area] = await db.insert(areas).values({ nombre: "Orgánico" }).returning();
    await db.insert(canales).values({ nombre: "Directo", utmSource: "direct", utmMedium: "organic", areaId: area.id });
    const [p1, p2] = await db.insert(programs).values([
      { slug: "uno", nombre: "Uno", ticketUsd: "100.00" },
      { slug: "dos", nombre: "Dos", ticketUsd: "200.00" },
    ]).returning();
    const [f1, f2] = await db.insert(sources).values([
      { programId: p1.id, nombre: "Formulario uno", sheetId: "s1", tab: "t1" },
      { programId: p2.id, nombre: "Formulario dos", sheetId: "s2", tab: "t2" },
    ]).returning();
    await db.insert(submissions).values([
      { sourceId: f1.id, token: "1", utmSource: " Instagram ", utmMedium: " Stories " },
      { sourceId: f1.id, token: "2", utmSource: "instagram", utmMedium: "stories" },
      { sourceId: f1.id, token: "3", utmSource: "instagram", utmMedium: "stories", esParcial: true },
      { sourceId: f2.id, token: "4", utmSource: "instagram", utmMedium: "stories" },
      { sourceId: f1.id, token: "5", utmSource: "direct", utmMedium: "organic" },
      { sourceId: f1.id, token: "6" },
    ]);

    expect(actor.id).toBeTruthy();
    expect(await paresSinClasificar(db)).toEqual([
      { programId: p1.id, programa: "Uno", source: "instagram", medium: "stories", envios: 2 },
      { programId: p2.id, programa: "Dos", source: "instagram", medium: "stories", envios: 1 },
    ]);
  });
});
