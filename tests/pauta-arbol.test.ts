import { afterEach, beforeEach, expect, it } from "vitest";
import { emparejar } from "@/lib/atribucion/emparejar";
import { cuentasPublicitarias, pautaObjetos, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { arbolDePauta } from "@/lib/pauta/arbol";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => ({ db, cerrar } = await crearBaseDePrueba()));
afterEach(async () => cerrar());

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
    { source: "facebook", medium: "paid_social", campaign: null, content: null, term: null, id: "ad" },
    await arbolDePauta(db, programa.id),
  );
  expect(traza.anuncio).toEqual({ anuncioId: "ad", conjuntoId: "set", campanaId: "camp" });
  expect(traza.campana).toEqual({ tipo: "meta", campanaId: "camp" });
});
