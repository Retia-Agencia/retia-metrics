import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { sql } from "drizzle-orm";
import { programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { carteraVencidaMcp, origenDelProgramaMcp, pautaRoasMcp } from "@/lib/mcp/herramientas/decisiones";
import { resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import {
  bandejaMcp,
  buscarLeadsMcp,
  fichaDeDealMcp,
  fichaDeLeadMcp,
  tableroDeDealsMcp,
} from "@/lib/mcp/herramientas/operacion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const medir = process.env.MEDIR_VOLUMEN === "1";

describe.skipIf(!medir)("herramientas MCP a 10x del volumen actual", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let gerenteId: string;
  let leadId: string;
  let dealId: string;

  function contexto(): ContextoMcp {
    const rol = "gerente" as const;
    const session = {
      user: {
        id: gerenteId,
        email: "gerente-volumen@retia.test",
        name: "Gerente volumen",
        rol,
        operaComoCloser: false,
        closerId: null,
        alcanceLimitado: false,
      },
    } as Session;
    return { db, session, rol, tokenId: crypto.randomUUID(), escritura: false };
  }

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseReutilizable());
    const programas = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "mcp-volumen-a", nombre: "MCP Volumen A", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "mcp-volumen-b", nombre: "MCP Volumen B", ticketUsd: "1000" },
    ]).returning();
    const fuentes = await db.insert(sources).values([
      { programId: programas[0].id, nombre: "Fuente A" },
      { programId: programas[1].id, nombre: "Fuente B" },
    ]).returning();
    const [gerente] = await db.insert(users).values({
      email: "gerente-volumen@retia.test",
      nombre: "Gerente volumen",
      rol: "gerente",
    }).returning();
    gerenteId = gerente.id;

    for (let programa = 0; programa < 2; programa += 1) {
      const prefijo = `mcp-vol-${programa}-`;
      await db.execute(sql`
        insert into leads (id, program_id, email_normalizado, nombre, fecha_primera_aplicacion)
        select md5(${prefijo} || 'lead-' || n)::uuid,
               ${programas[programa].id}::uuid,
               ${prefijo} || n || '@test.co',
               'Lead ' || n,
               timestamptz '2026-09-01 10:00:00-05' + ((n % 30) || ' days')::interval
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
        insert into deals
          (id, lead_id, program_id, submission_origen_id, etapa, valor_vendido_usd, fecha_limite_pago, owner_user_id)
        select md5(${prefijo} || 'deal-' || n)::uuid,
               md5(${prefijo} || 'lead-' || n)::uuid,
               ${programas[programa].id}::uuid,
               md5(${prefijo} || 'envio-' || n)::uuid,
               'ganado_parcial',
               1000,
               date '2026-08-31',
               ${gerenteId}::uuid
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

    leadId = await db.execute(sql`select md5('mcp-vol-0-lead-1')::uuid as id`).then((resultado) => {
      const filas = (Array.isArray(resultado) ? resultado : resultado.rows) as Array<{ id: string }>;
      return filas[0].id;
    });
    dealId = await db.execute(sql`select md5('mcp-vol-0-deal-1')::uuid as id`).then((resultado) => {
      const filas = (Array.isArray(resultado) ? resultado : resultado.rows) as Array<{ id: string }>;
      return filas[0].id;
    });
  }, 120_000);

  afterAll(async () => cerrar());

  it("mantiene cada ejecución por debajo del tope de humo de PGlite", async () => {
    const casos: Array<{ nombre: string; ejecutar: () => Promise<unknown> }> = [
      { nombre: "buscar_leads", ejecutar: () => buscarLeadsMcp.ejecutar(contexto(), { programa: "mcp-volumen-a", q: "", pagina: 1 }) },
      { nombre: "tablero_de_deals", ejecutar: () => tableroDeDealsMcp.ejecutar(contexto(), { programa: "mcp-volumen-a" }) },
      { nombre: "bandeja", ejecutar: () => bandejaMcp.ejecutar(contexto(), { programa: "mcp-volumen-a" }) },
      { nombre: "cartera_vencida", ejecutar: () => carteraVencidaMcp.ejecutar(contexto(), { programa: "mcp-volumen-a" }) },
      { nombre: "ficha_de_lead", ejecutar: () => fichaDeLeadMcp.ejecutar(contexto(), { programa: "mcp-volumen-a", id: leadId }) },
      { nombre: "ficha_de_deal", ejecutar: () => fichaDeDealMcp.ejecutar(contexto(), { programa: "mcp-volumen-a", id: dealId }) },
      { nombre: "origen_del_programa", ejecutar: () => origenDelProgramaMcp.ejecutar(contexto(), { programa: "mcp-volumen-a", periodo: "custom", desde: "2026-09-01", hasta: "2026-09-30" }) },
      { nombre: "pauta_roas", ejecutar: () => pautaRoasMcp.ejecutar(contexto(), { programa: "mcp-volumen-a", periodo: "custom", desde: "2026-09-01", hasta: "2026-09-30", nivel: "total" }) },
      { nombre: "resumen_del_hub", ejecutar: () => resumenDelHubMcp.ejecutar(contexto(), { programa: "mcp-volumen-a", periodo: "custom", desde: "2026-09-01", hasta: "2026-09-30" }) },
    ];
    const mediciones: Array<{ nombre: string; ms: number }> = [];

    for (const caso of casos) {
      const inicio = performance.now();
      await caso.ejecutar();
      const ms = performance.now() - inicio;
      mediciones.push({ nombre: caso.nombre, ms: Number(ms.toFixed(1)) });
      // Tope de humo para detectar regresiones grandes en PGlite; no es un SLA de producción.
      expect(ms, `${caso.nombre}: ${ms.toFixed(1)} ms`).toBeLessThan(2_000);
    }

    console.table(mediciones);
  }, 120_000);
});
