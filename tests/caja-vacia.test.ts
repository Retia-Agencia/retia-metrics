import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaConMonedaDelPrograma, cajaRecaudada, MONEDA_DE_CAJA } from "@/lib/queries/dashboard";
import { resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * D-3 (auditoría 18-nov): «Entró a caja» sin abonos se pintaba de cuatro maneras («—», USD 0, un texto, nada). Por N5 una
 * suma sin filas es 0 en la moneda del programa, y el único sitio que lo decide es `cajaConMonedaDelPrograma`.
 */
describe("la caja vacía: un solo vacío, en la fuente", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let gerenteId: string;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  beforeEach(async () => {
    await vaciar();
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "caja-vacia", nombre: "Caja vacía", ticketUsd: "1000" }).returning();
    programId = p.id;
    [{ id: gerenteId }] = await db.insert(users).values({ email: "gerente-caja@retia.test", rol: "gerente" }).returning();
  });
  afterAll(async () => cerrar());

  it("sin abonos, cajaRecaudada devuelve una fila de la moneda del programa con 0", async () => {
    const caja = await cajaRecaudada({ programId, rango: { desde: "2026-11-22", hasta: "2026-11-23" } }, db);
    expect(caja).toEqual([{ moneda: MONEDA_DE_CAJA, total: 0 }]);
  });

  it("resumen_del_hub sin abonos dice 0, no []", async () => {
    const contexto: ContextoMcp = {
      db, session: { user: { id: gerenteId, email: "g@retia.test", name: "g" } } as Session, rol: "gerente", tokenId: crypto.randomUUID(), escritura: false,
    };
    const salida = await resumenDelHubMcp.ejecutar(contexto, { programa: "caja-vacia", periodo: "custom", desde: "2026-11-02", hasta: "2026-11-03" });
    expect((salida.estructurado as { entro_a_caja: unknown }).entro_a_caja).toEqual([{ moneda: "USD", total: 0 }]);
  });

  it("con filas no inventa nada", () => {
    expect(cajaConMonedaDelPrograma([{ moneda: "USD", total: 5 }])).toEqual([{ moneda: "USD", total: 5 }]);
  });
});
