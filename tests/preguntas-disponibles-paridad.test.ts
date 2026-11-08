import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { desc, eq, sql } from "drizzle-orm";
import { leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ENVIOS_PARA_PREGUNTAS, preguntasDisponiblesDelPrograma } from "@/lib/queries/leads";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * Paridad de `preguntasDisponiblesDelPrograma`: la version nueva saca las llaves en SQL; la vieja
 * traia los jsonb y las juntaba en memoria. Debe dar lo mismo con datos de borde. La referencia
 * vieja vive aqui, copiada, para poder morder el cambio en los dos sentidos.
 */

async function referenciaVieja(db: Db, programId: string): Promise<string[]> {
  const envios = await db
    .select({ respuestas: submissions.respuestas })
    .from(submissions)
    .innerJoin(leads, eq(leads.id, submissions.leadId))
    .where(eq(leads.programId, programId))
    .orderBy(sql`${submissions.fechaEnvio} desc nulls last`, desc(submissions.createdAt))
    .limit(ENVIOS_PARA_PREGUNTAS);
  const llaves = new Set<string>();
  for (const e of envios) {
    const r = e.respuestas;
    if (r === null || typeof r !== "object" || Array.isArray(r)) continue;
    for (const k of Object.keys(r as Record<string, unknown>)) {
      if (!k.trim().toLowerCase().startsWith("utm_")) llaves.add(k);
    }
  }
  return [...llaves].sort((a, b) => a.localeCompare(b, "es"));
}

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let leadId: string;
let leadAjeno: string;
let sourceId: string;
let n = 0;

async function envio(lead: string, respuestas: unknown, fecha: string | null = "2026-09-01T12:00:00Z") {
  n += 1;
  await db.insert(submissions).values({
    leadId: lead,
    sourceId,
    token: `t${n}`,
    esParcial: false,
    fechaEnvio: fecha ? new Date(fecha) : null,
    respuestas: respuestas as never,
  });
}

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  n = 0;
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  otroProgramId = q.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "T" }).returning();
  sourceId = f.id;
  const [l, la] = await db
    .insert(leads)
    .values([
      { fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: "a@c.co" },
      { fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: otroProgramId, emailNormalizado: "b@c.co" },
    ])
    .returning();
  leadId = l.id;
  leadAjeno = la.id;
});

describe("preguntasDisponiblesDelPrograma: paridad con la version en memoria", () => {
  it("borde: repetidas, UTM en cualquier forma, no-objetos, nulos, otro programa y vacío", async () => {
    await envio(leadId, { "Pregunta B": "x", "Pregunta A": "y", utm_source: "ig", " UTM_medium": "p", "ñandú": "z" });
    await envio(leadId, { "Pregunta A": "otra vez", "Pregunta C": "" });
    await envio(leadId, ["array", "no objeto"]);
    await envio(leadId, "texto suelto");
    await envio(leadId, null);
    await envio(leadId, {});
    await envio(leadAjeno, { "Solo del otro programa": "x" });
    const nuevo = await preguntasDisponiblesDelPrograma(db, programId);
    expect(nuevo).toEqual(await referenciaVieja(db, programId));
    expect(nuevo).toEqual(["ñandú", "Pregunta A", "Pregunta B", "Pregunta C"].sort((a, b) => a.localeCompare(b, "es")));
    expect(nuevo).not.toContain("Solo del otro programa");
    expect(await preguntasDisponiblesDelPrograma(db, otroProgramId)).toEqual(["Solo del otro programa"]);
  });

  it("el corte de 500 envíos recientes se respeta: una pregunta solo de un envío más viejo no entra", async () => {
    await envio(leadId, { "Pregunta antigua": "x" }, "2020-01-01T00:00:00Z");
    const filas = Array.from({ length: ENVIOS_PARA_PREGUNTAS }, (_, i) => ({
      leadId,
      sourceId,
      token: `masivo${i}`,
      esParcial: false,
      fechaEnvio: new Date("2026-09-01T12:00:00Z"),
      respuestas: { "Pregunta vigente": "x" },
    }));
    await db.insert(submissions).values(filas);
    const nuevo = await preguntasDisponiblesDelPrograma(db, programId);
    expect(nuevo).toEqual(["Pregunta vigente"]);
    expect(nuevo).toEqual(await referenciaVieja(db, programId));
  });

  it("sin envíos devuelve vacío", async () => {
    expect(await preguntasDisponiblesDelPrograma(db, programId)).toEqual([]);
  });
});
