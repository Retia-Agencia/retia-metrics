import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cuentasPublicitarias, deals, gastoPauta, leads, pautaObjetos, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { arbolDePauta } from "@/lib/pauta/arbol";
import { atribucionPorDeal, atribuirEnviosDePauta, perteneceAlCorte, type CortePauta } from "@/lib/queries/atribucion-de-pauta";
import { cargarRoasDePauta, SIN_CUENTA } from "@/lib/queries/roas-de-pauta";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let cuentaId: string;
const RANGO = { desde: "2026-10-01", hasta: "2026-10-02" };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "atribucion-pauta", nombre: "Pauta", ticketUsd: "1000" }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  cuentaId = (await db.insert(cuentasPublicitarias).values({ programId, idMeta: "cuenta", nombre: "Cuenta", moneda: "USD", zonaHoraria: "America/Bogota" }).returning())[0].id;
  await db.insert(pautaObjetos).values([
    { programId, cuentaId, idMeta: "camp", nivel: "campana", nombre: "Campaña única", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "set", nivel: "conjunto", nombre: "Conjunto", padreIdMeta: "camp", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "ad", nivel: "anuncio", nombre: "Anuncio", padreIdMeta: "set", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "ambigua1", nivel: "campana", nombre: "Repetida", estado: "ACTIVE" },
    { programId, cuentaId, idMeta: "ambigua2", nivel: "campana", nombre: "Repetida", estado: "ACTIVE" },
  ]);
});

async function envio(utmId: string | null, utmCampaign: string | null = null, token = crypto.randomUUID(), esParcial = false) {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `${crypto.randomUUID()}@test.co`, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning())[0];
  const fila = (await db.insert(submissions).values({ sourceId, leadId: lead.id, token, esParcial,
    utmSource: "facebook", utmMedium: "cpc", utmId, utmCampaign,
    fechaEnvio: esParcial ? null : new Date("2026-10-02T10:00:00-05:00"),
    createdAt: new Date(esParcial ? "2026-09-30T10:00:00-05:00" : "2026-10-02T10:00:00-05:00"),
  }).returning())[0];
  return { ...fila, nombre: lead.nombre };
}

async function atribuir(envios: Awaited<ReturnType<typeof envio>>[], parejas: { parcialId: string; completoId: string }[] = []) {
  const objetos = await db.select().from(pautaObjetos).where(eq(pautaObjetos.programId, programId));
  return atribuirEnviosDePauta(envios, parejas, objetos, await arbolDePauta(db, programId), RANGO);
}

describe("atribución compartida de pauta", () => {
  it.each([
    ["anuncio", "ad", null, "ad", "set", "camp"],
    ["solo conjunto", "set", null, null, "set", "camp"],
    ["solo campaña", "camp", null, null, null, "camp"],
    ["campaña por nombre", null, "Campaña única", null, null, "camp"],
    ["campaña ambigua", null, "Repetida", null, null, null],
    ["sin anuncio", null, null, null, null, null],
  ])("resuelve %s sin inventar descendientes", async (_caso, id, nombre, anuncioId, conjuntoId, campanaId) => {
    const e = await envio(id, nombre);
    const resultado = await atribuir([e]);
    expect(resultado.canonicos.get(e.id)).toMatchObject({ envioId: e.id, anuncioId, conjuntoId, campanaId,
      cuentaId: campanaId ? cuentaId : null, cuentaComoRegistro: true });
  });

  it("pliega parcial fuera del periodo al completo y resuelve el deal por su alias", async () => {
    const completo = await envio("ad", null, "pareja");
    const parcial = await envio("camp", null, "pareja", true);
    const resultado = await atribuir([parcial, completo], [{ parcialId: parcial.id, completoId: completo.id }]);
    const canonico = resultado.canonicos.get(completo.id)!;
    expect(resultado.canonicos.size).toBe(1);
    expect(resultado.filaPorEnvioId.get(parcial.id)).toBe(canonico);
    expect(canonico).toMatchObject({ anuncioId: "ad", conjuntoId: "set", campanaId: "camp", cuentaId,
      diaEnvio: "2026-10-02", cuentaComoRegistro: true });
    const deal = (await db.insert(deals).values({ programId, leadId: parcial.leadId!, submissionOrigenId: parcial.id,
      ownerUserId: await duenoDePrueba(db, programId), etapa: "registrado" }).returning())[0];
    expect(atribucionPorDeal(resultado.filaPorEnvioId, [deal]).get(deal.id)).toBe(canonico);
  });

  it("un anuncio pertenece a los cuatro niveles y nunca a otro nodo", async () => {
    const e = await envio("ad");
    const a = (await atribuir([e])).canonicos.get(e.id)!;
    const cortes: CortePauta[] = [{ nivel: "anuncio", id: "ad" }, { nivel: "conjunto", id: "set" },
      { nivel: "campana", id: "camp" }, { nivel: "cuenta_meta", id: cuentaId }];
    for (const corte of cortes) {
      expect(perteneceAlCorte(a, corte)).toBe(true);
      expect(perteneceAlCorte(a, { ...corte, id: "otro" })).toBe(false);
    }
    const soloCampana = await envio("camp");
    const residual = (await atribuir([soloCampana])).canonicos.get(soloCampana.id)!;
    expect(perteneceAlCorte(residual, { nivel: "conjunto", id: "set" })).toBe(false);
    expect(perteneceAlCorte(residual, { nivel: "anuncio", id: "ad" })).toBe(false);
  });

  it("conserva gasto manual en Sin cuenta sin atribuirlo a un nodo de Meta", async () => {
    await db.insert(gastoPauta).values({ programId, fecha: "2026-10-02", monto: "25", moneda: "USD", origen: "manual", area: "paid" });
    const e = await envio(null);
    const a = (await atribuir([e])).canonicos.get(e.id)!;
    expect(a.cuentaId).toBeNull();
    expect(perteneceAlCorte(a, { nivel: "cuenta_meta", id: cuentaId })).toBe(false);
    expect(perteneceAlCorte(a, { nivel: "cuenta_meta", id: SIN_CUENTA })).toBe(false);
    const vista = await cargarRoasDePauta(db, programId, RANGO, RANGO.hasta);
    expect(vista.cuentas.find((c) => c.id === SIN_CUENTA)).toMatchObject({ gastoUsd: 25, registros: 1 });
    expect(vista.total.gastoUsd).toBe(25);
  });
});
