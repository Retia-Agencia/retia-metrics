import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cuentasPublicitarias, gastoPauta, pautaObjetos, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { trazaPorAnuncio } from "@/lib/queries/traza-por-anuncio";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("trazaPorAnuncio", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  beforeEach(async () => vaciar());
  afterAll(async () => cerrar());

  it("cruza gasto con pagos sin id por nombre sin escoger coincidencias ambiguas", async () => {
    const [programa, otro] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "traza", nombre: "Traza", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" },
    ]).returning();
    const [fuente, fuenteAjena] = await db.insert(sources).values([
      { programId: programa.id, nombre: "Formulario" }, { programId: otro.id, nombre: "Otro formulario" },
    ]).returning();
    const [cuenta] = await db.insert(cuentasPublicitarias).values({
      programId: programa.id, idMeta: "cuenta-traza", nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
    }).returning();
    const objetos = await db.insert(pautaObjetos).values([
      { cuentaId: cuenta.id, programId: programa.id, idMeta: "camp", nivel: "campana", nombre: "Campaña madre", estado: "ACTIVE" },
      { cuentaId: cuenta.id, programId: programa.id, idMeta: "set", nivel: "conjunto", padreIdMeta: "camp", nombre: "Conjunto", estado: "ACTIVE" },
      { cuentaId: cuenta.id, programId: programa.id, idMeta: "ad-1", nivel: "anuncio", padreIdMeta: "set", nombre: "Único", estado: "ACTIVE" },
      { cuentaId: cuenta.id, programId: programa.id, idMeta: "ad-2", nivel: "anuncio", padreIdMeta: "set", nombre: "Duplicado", estado: "PAUSED" },
      { cuentaId: cuenta.id, programId: programa.id, idMeta: "ad-3", nivel: "anuncio", padreIdMeta: "set", nombre: " duplicado ", estado: "ARCHIVED" },
      { cuentaId: cuenta.id, programId: programa.id, idMeta: "ad-4", nivel: "anuncio", padreIdMeta: "set", nombre: "Sin gasto", estado: "ACTIVE" },
    ]).returning();
    const id = (meta: string) => objetos.find((o) => o.idMeta === meta)!.id;
    await db.insert(gastoPauta).values([
      { programId: programa.id, fecha: "2026-11-05", monto: "200000", moneda: "COP", origen: "meta_api", pautaObjetoId: id("ad-1") },
      { programId: programa.id, fecha: "2026-11-05", monto: "300000", moneda: "COP", origen: "meta_api", pautaObjetoId: id("ad-2") },
      { programId: programa.id, fecha: "2026-11-05", monto: "100000", moneda: "COP", origen: "meta_api", pautaObjetoId: id("ad-3") },
      { programId: programa.id, fecha: "2026-10-30", monto: "999999", moneda: "COP", origen: "meta_api", pautaObjetoId: id("ad-1") },
    ]);
    const enRango = new Date("2026-11-05T12:00:00-05:00");
    const envio = (sourceId: string, token: string, extra: Partial<typeof submissions.$inferInsert> = {}) => ({
      sourceId, token, fechaEnvio: enRango, ...extra,
    });
    await db.insert(submissions).values([
      envio(fuente.id, "social", { utmMedium: "paid_social", utmContent: " único " }),
      envio(fuente.id, "cpc", { utmMedium: "cpc", utmTerm: "ÚNICO" }),
      envio(fuente.id, "sin-nombre", { utmMedium: "paid" }),
      envio(fuente.id, "ambiguo", { utmMedium: "paid_social", utmContent: "Duplicado" }),
      envio(fuente.id, "con-id", { utmMedium: "paid_social", utmContent: "Único", utmId: "123" }),
      envio(fuente.id, "macro", { utmMedium: "paid_social", utmContent: "Único", utmId: "{{ad.id}}" }),
      envio(fuente.id, "organico", { utmSource: "instagram", utmMedium: "organic" }),
      envio(fuente.id, "sin-utm"),
      envio(fuente.id, "sin-gasto", { utmMedium: "paid_social", utmContent: "Sin gasto" }),
      envio(fuente.id, "parcial", { utmMedium: "paid_social", utmContent: "Único", esParcial: true }),
      envio(fuente.id, "fuera", { utmMedium: "paid_social", utmContent: "Único", fechaEnvio: new Date("2026-11-04T12:00:00-05:00") }),
      envio(fuenteAjena.id, "ajeno", { utmMedium: "paid_social", utmContent: "Único" }),
    ]);

    const resultado = await trazaPorAnuncio(db, { programId: programa.id, rango: { desde: "2026-11-05", hasta: "2026-11-05" } });
    expect(resultado.anuncios).toEqual([{ idMeta: "ad-1", nombre: "Único", campana: "Campaña madre", gastoCop: 200000, enviosPagosSinId: 3 }]);
    expect(resultado).toMatchObject({
      sinAnuncioIdentificable: 2, pagosTotales: 7, pagosSinId: 6,
      registros: { total: 9, sinUtm: 1, porcentajeSinUtm: 1 / 9 },
    });
  });
});
