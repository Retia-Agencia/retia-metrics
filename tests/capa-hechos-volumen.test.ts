import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { areaSql } from "@/lib/atribucion/canal-sql";
import { programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agrupar } from "@/lib/queries/hechos/envio";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const medir = process.env.MEDIR_VOLUMEN === "1";

describe.skipIf(!medir)("capa de hechos a 10x del volumen actual", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const programas = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "volumen-a", nombre: "Volumen A", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "volumen-b", nombre: "Volumen B", ticketUsd: "1000" },
    ]).returning();
    programId = programas[0].id;
    const fuentes = await db.insert(sources).values([
      { programId: programas[0].id, nombre: "Fuente A" },
      { programId: programas[1].id, nombre: "Fuente B" },
    ]).returning();

    for (let programa = 0; programa < 2; programa += 1) {
      const prefijo = `vol-${programa}-`;
      await db.execute(sql`
        insert into leads (id, program_id, email_normalizado)
        select md5(${prefijo} || 'lead-' || n)::uuid,
               ${programas[programa].id}::uuid,
               ${prefijo} || n || '@test.co'
        from generate_series(1, 25000) n
      `);
      await db.execute(sql`
        insert into submissions
          (id, lead_id, source_id, token, es_parcial, fecha_envio, utm_source, utm_medium, utm_campaign)
        select md5(${prefijo} || 'envio-' || n)::uuid,
               md5(${prefijo} || 'lead-' || n)::uuid,
               ${fuentes[programa].id}::uuid,
               ${prefijo} || 'token-' || n,
               false,
               timestamptz '2026-09-01 10:00:00-05' + ((n % 30) || ' days')::interval,
               case when n % 3 = 0 then 'instagram rosario' else 'facebook' end,
               case when n % 4 = 0 then 'organic' else 'cpc' end,
               'campana-' || (n % 20)
        from generate_series(1, 25000) n
      `);
      await db.execute(sql`
        insert into deals (id, lead_id, program_id, submission_origen_id, etapa)
        select md5(${prefijo} || 'deal-' || n)::uuid,
               md5(${prefijo} || 'lead-' || n)::uuid,
               ${programas[programa].id}::uuid,
               md5(${prefijo} || 'envio-' || n)::uuid,
               'ganado_parcial'
        from generate_series(1, 1500) n
      `);
      await db.execute(sql`
        insert into calls (id, deal_id, program_id, fecha_agenda, resultado, origen)
        select md5(${prefijo} || 'call-' || n)::uuid,
               md5(${prefijo} || 'deal-' || (((n - 1) % 1500) + 1))::uuid,
               ${programas[programa].id}::uuid,
               timestamptz '2026-09-01 10:00:00-05' + ((n % 30) || ' days')::interval,
               case when n % 2 = 0 then 'show' else 'agendada' end::resultado_llamada,
               'sheets'
        from generate_series(1, 5000) n
      `);
      await db.execute(sql`
        insert into abonos (id, deal_id, program_id, fecha, monto, moneda)
        select md5(${prefijo} || 'abono-' || n)::uuid,
               md5(${prefijo} || 'deal-' || n)::uuid,
               ${programas[programa].id}::uuid,
               date '2026-09-01' + (n % 30),
               100,
               'USD'
        from generate_series(1, 1500) n
      `);
    }
  }, 120_000);

  afterAll(async () => cerrar());

  it("agrupa un mes por dia y area en menos de un segundo", async () => {
    const inicio = performance.now();
    const filas = await agrupar(db, {
      programId,
      rango: { desde: "2026-09-01", hasta: "2026-09-30" },
      agruparPor: ["dia", "area"],
    });
    const milisegundos = performance.now() - inicio;
    expect(filas.reduce((total, fila) => total + fila.envios, 0)).toBe(25_000);
    expect(milisegundos).toBeLessThan(1_000);

    const dia = sql<string>`(${submissions.fechaEnvio} AT TIME ZONE 'America/Bogota')::date`;
    const area = areaSql({ source: submissions.utmSource, medium: submissions.utmMedium });
    const fuente = await db.select({ id: sources.id }).from(sources).where(eq(sources.programId, programId)).then(([fila]) => fila);
    const plan = await db.execute(sql`explain (analyze, buffers)
      select ${dia}, ${area}, count(*)::int
      from ${submissions}
      inner join ${sources} on ${sources.id} = ${submissions.sourceId}
      where ${sources.id} = ${fuente.id}
        and ${submissions.esParcial} = false
        and ${dia} between '2026-09-01' and '2026-09-30'
      group by ${dia}, ${area}
    `);
    const filasPlan = (Array.isArray(plan) ? plan : plan.rows) as Array<Record<string, string>>;
    const textoPlan = filasPlan.map((fila) => Object.values(fila)[0]).join("\n");
    console.info(`capa-hechos-volumen: ${milisegundos.toFixed(1)} ms\n${textoPlan}`);
  }, 120_000);
});
