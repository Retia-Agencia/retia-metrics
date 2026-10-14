import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { areaSql, canalSql, cuentaSql } from "@/lib/atribucion/canal-sql";
import { resolverCanal } from "@/lib/atribucion/canal";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";

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
    base = await crearBaseDePrueba();
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
});
