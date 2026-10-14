import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { enviosPorCanal } from "@/lib/atribucion/envios-por-canal";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
beforeEach(async () => {
  await vaciar();
});
afterAll(async () => cerrar());

describe("envíos por canal (ticket 246)", () => {
  it("cuenta completos por la regla, agrupa entre programas y separa Sin UTM", async () => {
    const [p1, p2] = await db.insert(programs).values([
      { slug: "uno", nombre: "Uno", ticketUsd: "100.00" },
      { slug: "dos", nombre: "Dos", ticketUsd: "200.00" },
    ]).returning();
    const [f1, f2] = await db.insert(sources).values([
      { programId: p1.id, nombre: "Formulario uno", sheetId: "s1", tab: "t1" },
      { programId: p2.id, nombre: "Formulario dos", sheetId: "s2", tab: "t2" },
    ]).returning();
    await db.insert(submissions).values([
      { sourceId: f1.id, token: "1", utmSource: " Instagram   Rosario ", utmMedium: " Stories " },
      { sourceId: f1.id, token: "2", utmSource: "ig rosario", utmMedium: "stories" },
      { sourceId: f1.id, token: "3", utmSource: "instagram rosario", utmMedium: "stories", esParcial: true },
      { sourceId: f2.id, token: "4", utmSource: "facebook", utmMedium: "cpc" },
      { sourceId: f1.id, token: "5", utmMedium: "paid_social" },
      { sourceId: f1.id, token: "6" },
      { sourceId: f1.id, token: "7", utmSource: "facebook", utmMedium: "organic" },
      { sourceId: f1.id, token: "8", utmMedium: "video" },
    ]);

    expect(await enviosPorCanal(db)).toEqual({
      canales: [
        { clave: "instagram rosario", nombre: "Instagram · Rosario", area: "organico", envios: 2 },
        { clave: "", nombre: "(sin utm_source)", area: "organico", envios: 1 },
        { clave: "", nombre: "(sin utm_source)", area: "paid", envios: 1 },
        { clave: "facebook", nombre: "Facebook", area: "organico", envios: 1 },
        { clave: "facebook", nombre: "Facebook", area: "paid", envios: 1 },
      ],
      sinUtm: 1,
    });
  });
});
