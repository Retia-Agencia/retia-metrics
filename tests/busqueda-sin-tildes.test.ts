import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sinTildes } from "@/lib/busqueda-sin-tildes";
import { leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import { buscarLeads } from "@/lib/queries/leads";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/** `Cesar` y `César` son la misma búsqueda, en memoria y en SQL. */
describe("búsqueda sin tildes", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [p] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
      .returning();
    programId = p.id;
  });

  afterAll(async () => {
    await cerrar();
  });

  async function crearLead(nombre: string, email: string) {
    const [lead] = await db
      .insert(leads)
      .values({ programId, nombre, emailNormalizado: email })
      .returning();
    return lead.id;
  }

  it("sinTildes quita tildes, eñes y mayúsculas", () => {
    expect(sinTildes("CÉSAR Núñez Müller")).toBe("cesar nunez muller");
  });

  it.each([
    ["Cesar", "César Pérez"],
    ["César", "Cesar Perez"],
    ["CESAR", "césar"],
    ["ÉSAR", "CÉSAR"],
    ["nunez", "NÚÑEZ"],
    ["Núñez", "Nunez"],
    // La tilde como carácter aparte (NFD), como llega de algunos teclados.
    ["cesar", "César"],
  ])("%s encuentra a %s", async (busqueda, nombre) => {
    const id = await crearLead(nombre, "a@b.co");
    expect(await leadsQueCasan(db, programId, busqueda)).toEqual(new Set([id]));
    expect((await buscarLeads(db, programId, busqueda)).map((l) => l.id)).toEqual([id]);
  });

  it("SQL y TypeScript responden igual con cada letra con tilde", async () => {
    const letras = "áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ";
    const id = await crearLead(letras, "a@b.co");
    expect(await leadsQueCasan(db, programId, sinTildes(letras))).toEqual(new Set([id]));
  });

  it("un % o un _ se buscan literales", async () => {
    await crearLead("Ana", "ana@b.co");
    expect(await leadsQueCasan(db, programId, "a%a")).toEqual(new Set());
    expect(await leadsQueCasan(db, programId, "a_a")).toEqual(new Set());
  });

  it("ninguna búsqueda vuelve a ilike: se saltaría las tildes", () => {
    const archivos = (dir: string): string[] =>
      readdirSync(dir).flatMap((nombre) => {
        const ruta = join(dir, nombre);
        return statSync(ruta).isDirectory() ? archivos(ruta) : /\.tsx?$/.test(ruta) ? [ruta] : [];
      });
    const conIlike = ["lib", "app", "components"]
      .flatMap(archivos)
      .filter((ruta) => /\bilike\(/.test(readFileSync(ruta, "utf8")));
    expect(conIlike).toEqual([]);
  });
});
