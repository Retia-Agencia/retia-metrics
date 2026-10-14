import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cuentasPublicitarias, gastoPauta, pautaObjetos, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { registrarGasto } from "@/lib/pauta/gasto";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let objetoId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: "gasto", nombre: "Gasto", ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const [cuenta] = await db.insert(cuentasPublicitarias).values({
    idMeta: "cuenta-gasto", programId, nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  }).returning();
  const [objeto] = await db.insert(pautaObjetos).values({
    cuentaId: cuenta.id, programId, idMeta: "ad-gasto", nivel: "anuncio", padreIdMeta: "set",
    nombre: "Anuncio", estado: "ACTIVE",
  }).returning();
  objetoId = objeto.id;
});

afterAll(async () => cerrar());

it("los CHECK rechazan dos destinos y ningún destino", async () => {
  const base = { programId, fecha: "2026-10-14", monto: "1", moneda: "COP", origen: "manual" as const };
  await expect(db.insert(gastoPauta).values({ ...base, pautaObjetoId: objetoId, area: "paid" }))
    .rejects.toBeDefined();
  await expect(db.insert(gastoPauta).values(base)).rejects.toBeDefined();
});

it("el CHECK rechaza gasto meta_api sin objeto", async () => {
  await expect(db.insert(gastoPauta).values({
    programId, fecha: "2026-10-14", monto: "1", moneda: "COP", origen: "meta_api", area: "paid",
  })).rejects.toBeDefined();
});

it("guarda el monto como la cadena exacta que llega", async () => {
  await registrarGasto(db, [{
    programId, fecha: "2026-10-14", monto: "120.50", moneda: "cop",
    agendasMeta: 3, origen: "meta_api", pautaObjetoId: objetoId,
  }]);
  const [fila] = await db.select().from(gastoPauta)
    .where(eq(gastoPauta.pautaObjetoId, objetoId));
  expect(fila).toMatchObject({ monto: "120.50", moneda: "COP", agendasMeta: 3 });
});

it("rechaza un monto con más de dos decimales", async () => {
  await expect(registrarGasto(db, [{
    programId, fecha: "2026-10-14", monto: "120.567", moneda: "COP",
    origen: "meta_api", pautaObjetoId: objetoId,
  }])).rejects.toBeDefined();
});
