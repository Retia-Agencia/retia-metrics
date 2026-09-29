import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  entradaDesdeTypeform,
  payloadTypeformSchema,
  type PayloadTypeform,
} from "@/lib/ingesta/adaptador-typeform";
import { mapeoWebhookDesdeFuente } from "@/lib/ingesta/mapeo-webhook";
import { construirEnvio } from "@/lib/ingesta/envio";
import { entradasDesdeMatriz } from "@/lib/ingesta/adaptador-sheets";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import completo from "./fixtures/typeform-completo.json";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 070, parte A: el CRM LEE el score que el formulario calcula, no lo calcula
 * (decisión A8, 28-sep; decisión del 29-sep). Una llave del mapeo de la fuente (`puntaje`)
 * nombra la variable de Typeform; su valor entra a `submissions.puntaje` y al resumen
 * `leads.puntaje`. Un valor no numérico, o sin mapeo, entra null: nunca se adivina.
 */

// El fixture trae la variable `score` (number 0) y `estado`.
function payload(): PayloadTypeform {
  return payloadTypeformSchema.parse(completo);
}

const OPCIONES_BASE = { sourceId: "src-1", zona: "America/Bogota" };

describe("adaptador de score (parte A, puro)", () => {
  it("lee el score de la variable que el mapeo nombra, como entero", () => {
    const p = payload();
    p.form_response.variables = [
      { key: "estado", type: "text", text: "setteo_no_calificado" },
      { key: "score", type: "number", number: 42 },
    ];
    const entrada = entradaDesdeTypeform(p, { ...OPCIONES_BASE, mapeo: { variablePuntaje: "score" } });
    expect(entrada.puntaje).toBe(42);
    const r = construirEnvio(entrada);
    expect(r.ok && r.envio.puntaje).toBe(42);
  });

  it("SIN mapeo de puntaje, el score es null aunque la variable venga en el payload", () => {
    const p = payload();
    p.form_response.variables = [{ key: "score", type: "number", number: 42 }];
    const entrada = entradaDesdeTypeform(p, OPCIONES_BASE);
    expect(entrada.puntaje).toBeNull();
    const r = construirEnvio(entrada);
    expect(r.ok && r.envio.puntaje).toBeNull();
  });

  it("un valor no numérico entra null, no se adivina", () => {
    const p = payload();
    p.form_response.variables = [{ key: "score", type: "text", text: "alto" }];
    const entrada = entradaDesdeTypeform(p, { ...OPCIONES_BASE, mapeo: { variablePuntaje: "score" } });
    expect(entrada.puntaje).toBeNull();
  });

  it("apunta a OTRA variable si el mapeo lo dice", () => {
    const p = payload();
    p.form_response.variables = [
      { key: "score", type: "number", number: 1 },
      { key: "puntos", type: "number", number: 77 },
    ];
    const entrada = entradaDesdeTypeform(p, { ...OPCIONES_BASE, mapeo: { variablePuntaje: "puntos" } });
    expect(entrada.puntaje).toBe(77);
  });

  it("un score con decimales se redondea a entero (la columna es integer)", () => {
    const p = payload();
    p.form_response.variables = [{ key: "score", type: "number", number: 8.6 }];
    const entrada = entradaDesdeTypeform(p, { ...OPCIONES_BASE, mapeo: { variablePuntaje: "score" } });
    expect(entrada.puntaje).toBe(9);
  });

  it("mapeoWebhookDesdeFuente traduce la llave `puntaje` a variablePuntaje", () => {
    const m = mapeoWebhookDesdeFuente({ puntaje: "score" }, null);
    expect(m.variablePuntaje).toBe("score");
  });

  it("el adaptador de Sheets nunca trae score: null", () => {
    const matriz = [
      ["token", "correo electronico", "submitted at"],
      ["t1", "ana@correo.co", "2026-09-20T15:00:00Z"],
    ];
    const [entrada] = entradasDesdeMatriz(matriz, { sourceId: "src-1" });
    expect(entrada.puntaje).toBeUndefined();
    const r = construirEnvio(entrada);
    expect(r.ok && r.envio.puntaje).toBeNull();
  });
});

describe("el score aterriza en submission y en el resumen del lead", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let sourceId: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" }).returning();
    programId = p.id;
    const [f] = await db.insert(sources).values({ programId, nombre: "Typeform", tipo: "google_sheet" }).returning();
    sourceId = f.id;
  }, 60_000);

  afterEach(async () => {
    await cerrar();
  });

  function entradaConScore(numero: number | null): ReturnType<typeof entradaDesdeTypeform> {
    const p = payload();
    p.form_response.token = "tok-score";
    p.form_response.variables = [
      { key: "estado", type: "text", text: "setteo_no_calificado" },
      ...(numero === null ? [] : [{ key: "score" as const, type: "number" as const, number: numero }]),
    ];
    return {
      ...entradaDesdeTypeform(p, { sourceId, zona: "America/Bogota", mapeo: { variablePuntaje: "score" } }),
      sourceId,
    };
  }

  it("con la variable: el puntaje queda en la submission y en el lead", async () => {
    await ingerirEntradas(db, programId, [entradaConScore(63)]);

    const [sub] = await db.select().from(submissions).where(eq(submissions.token, "tok-score"));
    expect(sub.puntaje).toBe(63);
    // versionPuntaje sigue nulo: no hay pesos del CRM.
    expect(sub.versionPuntaje).toBeNull();

    const [lead] = await db.select().from(leads).where(eq(leads.emailNormalizado, "ana.perez@correo.co"));
    expect(lead.puntaje).toBe(63);
  });

  it("sin la variable de score: submission y lead quedan con puntaje null", async () => {
    await ingerirEntradas(db, programId, [entradaConScore(null)]);
    const [sub] = await db.select().from(submissions).where(eq(submissions.token, "tok-score"));
    expect(sub.puntaje).toBeNull();
    const [lead] = await db.select().from(leads).where(eq(leads.emailNormalizado, "ana.perez@correo.co"));
    expect(lead.puntaje).toBeNull();
  });
});
