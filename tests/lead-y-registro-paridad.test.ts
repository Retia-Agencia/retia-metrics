import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { Db } from "@/lib/db/tipos";
import { consultarMetricaMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { HOY_DORADO, sembrarDorada, type SemillaDorada } from "./helpers/semilla-dorada";

/**
 * Paridad de LEAD (403 F3, ADR 0115 N2): la misma cifra en el Hub y en el MCP, con el esperado escrito a mano.
 * Todos los leads de la semilla dorada nacen el 1-ene-2020 (`FECHA_LEAD_DE_PRUEBA`), así que el rango cubre ese día.
 * Programa A: 10 leads (a1 a a10; un deal anulado o de cortesía no quita al lead). Programa B: 3 (b1, b2 y b3). b3
 * comparte correo con a1 y son DOS leads, uno por programa: nunca se cruzan.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let s: SemillaDorada;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  s = await sembrarDorada(db);
}, 60_000);

const RANGO = { desde: "2019-12-30", hasta: "2020-01-05" };
const ESPERADO = { A: 10, B: 3 } as const;

function contexto(): ContextoMcp {
  return {
    db,
    session: { user: { id: s.gerenteId, email: "gerente-dorado@retia.test", name: "gerente" } } as Session,
    rol: "gerente",
    tokenId: crypto.randomUUID(),
    escritura: false,
  };
}


describe("lead: el Hub y el MCP cuentan lo mismo", () => {
  it.each([["A", ESPERADO.A], ["B", ESPERADO.B]] as const)("programa %s: %i leads", async (p, esperado) => {
    const programId = p === "A" ? s.programaA : s.programaB;
    const slug = p === "A" ? s.slugA : s.slugB;
    const vista = await armarVistaDelDashboard({
      programId, hoy: HOY_DORADO, preset: "custom", periodo: { preset: "custom", a: RANGO, comparaciones: [] },
    }, db);
    expect(vista.leads.leads).toBe(esperado);

    const salida = await consultarMetricaMcp.ejecutar(contexto(), {
      programa: slug, metrica: "leads", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta, pagina: 1,
    });
    expect((salida.estructurado.resumen as { total: number }).total).toBe(esperado);
  });
});
