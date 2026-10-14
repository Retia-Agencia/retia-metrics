import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { areaSql, canalSql, columnasIdMetaDelEnvio, cuentaSql, idEnArbolSql } from "@/lib/atribucion/canal-sql";
import { resolverCanal } from "@/lib/atribucion/canal";
import { emparejar, type ArbolDePauta } from "@/lib/atribucion/emparejar";
import { sources, submissions } from "@/lib/db/schema";
import { crearBaseReutilizable, type BaseDePrueba } from "./helpers/base-de-prueba";

const CASOS: ReadonlyArray<readonly [string | null, string | null]> = [
  ["whatsapp rosario", "chat"],
  ["instagram", "dm"],
  ["instagram milena", "linktree"],
  ["tiktok", "manychat"],
  ["youtube", "linktree"],
  ["direct", "organic"],
  ["leadmagnetdiagnostico", "pdf"],
  ["instagram rosario", "storiesfijadas"],
  ["instagram", "storiesmanychat"],
  ["facebook", "cpc"],
  ["fb", "paid"],
  ["ig", "paid_social"],
  [null, "paid_social"],
  ["closer", "referido"],
  ["  IG   ROSARIO ", " DM "],
  ["AN Norte", "paid"],
  ["MSG equipo uno", "organic"],
  ["TH", "organic"],
  ["instagram", "{{placement}}"],
  [null, "{{campaign.name}}"],
  ["{{site_source_name}}", ""],
  ["  ", " "],
  [null, null],
];

describe("la atribucion SQL es gemela de resolverCanal", () => {
  let base: BaseDePrueba;
  beforeAll(async () => {
    base = await crearBaseReutilizable();
  });
  afterAll(async () => {
    await base.cerrar();
  });

  it("coincide en area, canal y cuenta contra Postgres", async () => {
    for (const [source, medium] of CASOS) {
      const columnas = { source: sql`${source}::text`, medium: sql`${medium}::text` };
      const resultado = await base.db.execute(sql`select
        ${areaSql(columnas)} as area,
        ${canalSql(columnas)} as canal,
        ${cuentaSql(columnas)} as cuenta
      `);
      const filas = (Array.isArray(resultado) ? resultado : resultado.rows) as Array<{
        area: string;
        canal: string | null;
        cuenta: string | null;
      }>;
      const esperado = resolverCanal({ source, medium });
      expect(filas[0], `${source} / ${medium}`).toEqual({
        area: esperado.area,
        canal: esperado.canal?.clave ?? null,
        cuenta: esperado.canal?.cuenta ?? null,
      });
    }
  });

  it("hace paid solo el id que existe en el árbol del mismo programa", async () => {
    const columnas = { source: submissions.utmSource, medium: submissions.utmMedium };
    const idEnArbol = idEnArbolSql({
      programId: sources.programId,
      ...columnasIdMetaDelEnvio,
    });
    const compilada = base.db.select({ area: areaSql(columnas, idEnArbol) })
      .from(submissions).innerJoin(sources, sql`true`).toSQL().sql;
    expect(compilada).toContain('po.program_id = "sources"."program_id"');
    expect(compilada).toContain('"submissions"."respuestas"');

    const arbol: ArbolDePauta = {
      anuncios: [{ id: "ad-1", conjuntoId: "set-1", campanaId: "camp-1" }],
      conjuntos: [{ id: "set-1", campanaId: "camp-1" }],
      campanas: [{ id: "camp-1", nombre: "Campaña" }],
    };
    const utms = {
      source: "ig",
      medium: "social",
      campaign: null,
      content: null,
      term: null,
      id: null,
      idsMeta: { adId: "ad-1", adsetId: null, campaignId: null },
    };

    for (const [programaDelObjeto, arbolTs] of [["programa-envio", arbol], ["otro-programa", {
      anuncios: [], conjuntos: [], campanas: [],
    } satisfies ArbolDePauta]] as const) {
      const resultado = await base.db.execute(sql`
        with submissions(utm_id, respuestas, utm_source, utm_medium) as (
          values (null::text, '{"ad_id":"ad-1"}'::jsonb, 'ig', 'social')
        ), sources(program_id) as (
          values ('programa-envio')
        ), pauta_objetos(program_id, id_meta) as (
          values (${programaDelObjeto}, 'ad-1')
        )
        select ${areaSql(columnas, idEnArbol)} as area from submissions cross join sources
      `);
      const filas = (Array.isArray(resultado) ? resultado : resultado.rows) as Array<{ area: string }>;
      expect(filas[0].area).toBe(emparejar(utms, arbolTs).origen.area);
    }
  });
});
