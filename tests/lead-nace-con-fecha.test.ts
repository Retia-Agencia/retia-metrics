import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 389, ADR 0121 (M2): un lead de formulario NACE con su primera aplicacion. Este archivo crea el CHECK
 * de la migracion M2 sobre su base de prueba, asi el INSERT del lead nuevo (no solo el recalculo del resumen al
 * final de la transaccion) tiene que traer la fecha: sin ella la base rechaza el envio entero.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;

const CAMPOS = { token: "Token", correo: "Correo", fechaEnvio: "Submitted At" } as const;
const entrada = (token: string, correo: string, fecha: string | null): EntradaEnvio => ({
  sourceId,
  zona: "UTC",
  posicion: null,
  columnas: { Token: token, Correo: correo, "Submitted At": fecha ?? "1/1/0001 0:00:00" },
  campos: { ...CAMPOS },
});

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  await (db as unknown as { $client: { exec(sql: string): Promise<unknown> } }).$client.exec(
    "ALTER TABLE leads ADD CONSTRAINT leads_formulario_con_fecha CHECK (entrada <> 'formulario' OR fecha_primera_aplicacion IS NOT NULL)",
  );
});

beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" }).returning();
  programId = p.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform", tipo: "google_sheet" }).returning();
  sourceId = f.id;
});

afterAll(async () => {
  await cerrar();
});

describe("el lead de formulario nace con fecha (ADR 0121)", () => {
  it("el CHECK muerde: un lead de formulario sin fecha se rechaza y uno de alta manual no", async () => {
    await expect(db.insert(leads).values({ programId, emailNormalizado: "sin@fecha.co" })).rejects.toThrow();
    await expect(db.insert(leads).values({ programId, emailNormalizado: "crm@fecha.co", entrada: "crm" })).resolves.toBeDefined();
  });

  it("un envio completo con fecha crea el lead con esa fecha", async () => {
    await ingerirEntradas(db, programId, [entrada("t1", "ana@correo.co", "2026-09-20T15:00:00Z")]);
    const [lead] = await db.select().from(leads);
    expect(lead.fechaPrimeraAplicacion?.toISOString()).toBe("2026-09-20T15:00:00.000Z");
  });

  it("un parcial sin fecha_envio crea el lead con la fecha en que el CRM lo recibio", async () => {
    const antes = Date.now();
    await ingerirEntradas(db, programId, [entrada("p1", "parcial@correo.co", null)]);
    const [lead] = await db.select().from(leads);
    const [envio] = await db.select().from(submissions);
    expect(envio.fechaEnvio).toBeNull();
    expect(lead.fechaPrimeraAplicacion).not.toBeNull();
    expect(lead.fechaPrimeraAplicacion!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });

  it("dos envios del mismo correo nuevo en un lote: nace con la mas antigua", async () => {
    await ingerirEntradas(db, programId, [
      entrada("a", "beto@correo.co", "2026-09-10T00:00:00Z"),
      entrada("b", "beto@correo.co", "2026-09-01T00:00:00Z"),
    ]);
    const [lead] = await db.select().from(leads);
    expect(lead.fechaPrimeraAplicacion?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
