import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { emparejar } from "@/lib/atribucion/emparejar";
import { cuentasPublicitarias, pautaObjetos, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { arbolDePauta } from "@/lib/pauta/arbol";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const VACIOS = {
  source: null,
  medium: null,
  campaign: null,
  content: null,
  term: null,
  id: null,
  idsMeta: { adId: null, adsetId: null, campaignId: null },
};

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

it("utm_id resuelve el anuncio, conjunto y campaña sincronizados", async () => {
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: "arbol", nombre: "Árbol", ticketUsd: "1000",
  }).returning();
  const [cuenta] = await db.insert(cuentasPublicitarias).values({
    idMeta: "cuenta-arbol", programId: programa.id, nombre: "Cuenta", moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning();
  await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId: programa.id, idMeta: "camp", nivel: "campana", nombre: "Campaña", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programa.id, idMeta: "set", nivel: "conjunto", padreIdMeta: "camp", nombre: "Conjunto", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programa.id, idMeta: "ad", nivel: "anuncio", padreIdMeta: "set", nombre: "Anuncio", estado: "ACTIVE" },
  ]);
  const traza = emparejar(
    { ...VACIOS, source: "facebook", medium: "paid_social", id: "ad" },
    await arbolDePauta(db, programa.id),
  );
  expect(traza.anuncio).toEqual({ anuncioId: "ad", conjuntoId: "set", campanaId: "camp" });
  expect(traza.conjunto).toEqual({ conjuntoId: "set", campanaId: "camp" });
  expect(traza.campana).toEqual({ tipo: "meta", campanaId: "camp" });
});

it("expone los conjuntos y permite resolver una campaña por su id", async () => {
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: "arbol-campana", nombre: "Árbol campaña", ticketUsd: "1000",
  }).returning();
  const [cuenta] = await db.insert(cuentasPublicitarias).values({
    idMeta: "cuenta-campana", programId: programa.id, nombre: "Cuenta", moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning();
  await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId: programa.id, idMeta: "52532647547375", nivel: "campana", nombre: "Campaña", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId: programa.id, idMeta: "set", nivel: "conjunto", padreIdMeta: "52532647547375", nombre: "Conjunto", estado: "ACTIVE" },
  ]);
  const arbol = await arbolDePauta(db, programa.id);
  expect(arbol.conjuntos).toEqual([{ id: "set", campanaId: "52532647547375" }]);
  expect(emparejar({ ...VACIOS, id: "52532647547375" }, arbol)).toMatchObject({
    nivel: "N2",
    campana: { tipo: "meta", campanaId: "52532647547375" },
    avisos: [],
  });
});
