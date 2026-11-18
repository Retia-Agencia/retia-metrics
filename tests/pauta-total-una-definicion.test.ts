import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { calls, cohorts, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { cargarPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { cohorteDeLaPauta, resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { TODAS_LAS_COHORTES } from "@/lib/queries/cohorte-del-hub";
import { hoyEnBogota } from "@/lib/format";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * D-13 (auditoría 18-nov): la columna Total de Pauta de la pantalla («Todas») y la de `resumen_del_hub` salían de
 * poblaciones distintas: el MCP pasaba la cohorte ACTIVA (`elegida`) a la tabla aunque la respuesta no pidiera cohorte.
 * Con una cohorte activa y una agenda fuera de ella, Agendadas daba 2 en el MCP y 3 en la pantalla.
 */
const RANGO = { desde: "2026-11-02", hasta: "2026-11-08" };

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let gerenteId: string;
let c1: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

let n = 0;
async function agenda(cohorteId: string | null) {
  const token = `t${++n}`;
  const [fuente] = await db.select().from(sources);
  const [lead] = await db.insert(leads).values({ programId, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, emailNormalizado: `${token}@test.co` }).returning();
  const [envio] = await db.insert(submissions).values({
    sourceId: fuente.id, leadId: lead.id, token, utmSource: "meta", utmMedium: "paid_social", fechaEnvio: new Date("2026-11-03T09:00:00-05:00"),
  }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, submissionOrigenId: envio.id, cohortId: cohorteId }).returning();
  await db.insert(calls).values({ programId, dealId: deal.id, createdAt: new Date("2026-11-03T11:00:00-05:00") });
}

beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "total-pauta", nombre: "Total Pauta", ticketUsd: "1000" }).returning();
  programId = p.id;
  await db.insert(sources).values({ programId, nombre: "Fuente" });
  const [g] = await db.insert(users).values({ email: "gerente-total@retia.test", rol: "gerente" }).returning();
  gerenteId = g.id;
  [{ id: c1 }] = await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioVentas: "2026-11-01",
    fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "activo",
  }).returning();
  await agenda(c1);
  await agenda(c1);
  await agenda(null);
}, 60_000);

const contexto = (): ContextoMcp => ({
  db,
  session: { user: { id: gerenteId, email: "gerente@retia.test", name: "g" } } as Session,
  rol: "gerente",
  tokenId: crypto.randomUUID(),
  escritura: false,
});

describe("Total de Pauta: una sola definición para la pantalla y el MCP (D-13)", () => {
  it("resumen_del_hub y la pantalla en «Todas» dan las mismas Agendadas con una cohorte activa", async () => {
    const entrada = { programId, hoy: hoyEnBogota(), periodo: { preset: "custom" as const, a: RANGO, comparaciones: [] }, preset: "custom" };
    const pantalla = await resolverContextoDeVista({ ...entrada, filtroDeCohorte: { parametro: TODAS_LAS_COHORTES } }, db);
    const vista = await cargarPautaSemanal(db, { programId, rango: RANGO, hoy: hoyEnBogota(), cohorteId: cohorteDeLaPauta(pantalla), paso: "semana" });
    const agendasPantalla = vista.filas.find((f) => f.clave === "agendas")!.celdas.total.valor;
    expect(agendasPantalla).toBe(3);

    const salida = await resumenDelHubMcp.ejecutar(contexto(), { programa: "total-pauta", periodo: "custom", desde: RANGO.desde, hasta: RANGO.hasta });
    const mcp = (salida.estructurado as { pauta: Array<{ clave: string; valor: number | null }> }).pauta;
    for (const fila of vista.filas) {
      expect(mcp.find((f) => f.clave === fila.clave)?.valor, fila.clave).toBe(fila.celdas.total.valor);
    }
  });

  it("la cohorte de la Pauta es la del filtro de la vista, no la activa", async () => {
    const entrada = { programId, hoy: hoyEnBogota(), periodo: { preset: "custom" as const, a: RANGO, comparaciones: [] }, preset: "custom" };
    const sinFiltro = await resolverContextoDeVista(entrada, db);
    expect(sinFiltro.filtroDeCohorte.elegida?.id).toBe(c1);
    expect(cohorteDeLaPauta(sinFiltro)).toBeNull();
    const conFiltro = await resolverContextoDeVista({ ...entrada, filtroDeCohorte: {} }, db);
    expect(cohorteDeLaPauta(conFiltro)).toBe(c1);
  });
});
