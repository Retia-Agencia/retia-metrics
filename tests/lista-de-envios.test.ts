import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { deals, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agrupar } from "@/lib/queries/hechos/envio";
import {
  listaDeMetrica,
  proyectarParaTablero,
  TAMANO_PAGINA,
  type FiltrosDeMetrica,
} from "@/lib/queries/metricas-con-filas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const RANGO = { desde: "2026-10-01", hasta: "2026-10-31" };
const HOY = "2026-10-24";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "envios", nombre: "Envíos", ticketUsd: "100" },
    { ...PROGRAMA_DE_PRUEBA, slug: "envios-otro", nombre: "Otro", ticketUsd: "100" },
  ]).returning();
  programId = programas[0].id;
  const fuentes = await db.insert(sources).values([
    { programId, nombre: "Formulario" },
    { programId: programas[1].id, nombre: "Formulario ajeno" },
  ]).returning();

  const personas = await db.insert(leads).values([
    ...Array.from({ length: 53 }, (_, indice) => ({
      programId,
      emailNormalizado: `persona-${indice}@retia.test`,
      nombre: indice === 0 ? "Ana" : null,
    })),
    { programId: programas[1].id, emailNormalizado: "ajena@retia.test", nombre: "Ajena" },
  ]).returning();
  const envios = await db.insert(submissions).values([
    ...personas.slice(0, 51).map((persona, indice) => ({
      leadId: persona.id,
      sourceId: fuentes[0].id,
      token: `paid-${indice}`,
      fechaEnvio: new Date(`2026-10-${String((indice % 20) + 1).padStart(2, "0")}T10:00:00-05:00`),
      utmSource: "facebook",
      utmMedium: "cpc",
    })),
    {
      leadId: personas[51].id,
      sourceId: fuentes[0].id,
      token: "sin-utm",
      fechaEnvio: new Date("2026-10-22T10:00:00-05:00"),
    },
    {
      leadId: personas[52].id,
      sourceId: fuentes[0].id,
      token: "macro",
      fechaEnvio: new Date("2026-10-23T10:00:00-05:00"),
      utmSource: "{{site_source_name}}",
      utmMedium: "cpc",
    },
    {
      leadId: personas[0].id,
      sourceId: fuentes[0].id,
      token: "parcial",
      esParcial: true,
      fechaEnvio: new Date("2026-10-24T10:00:00-05:00"),
    },
    {
      leadId: personas[53].id,
      sourceId: fuentes[1].id,
      token: "ajeno",
      fechaEnvio: new Date("2026-10-24T10:00:00-05:00"),
    },
  ]).returning();
  await db.insert(deals).values({
    programId,
    leadId: personas[0].id,
    submissionOrigenId: envios[0].id,
  });
}, 60_000);

afterAll(async () => cerrar());

async function todasLasFilas(filtros: Omit<FiltrosDeMetrica, "programId" | "rango" | "hoy"> = {}) {
  const base = { programId, rango: RANGO, hoy: HOY, ...filtros };
  const [primera] = await listaDeMetrica("registros", base, 1, db);
  const [segunda] = await listaDeMetrica("registros", base, 2, db);
  return { lista: primera, filas: [...primera.filas, ...segunda.filas] };
}

describe("ticket 309: una sola lista de envíos", () => {
  it("registros y el hecho cuentan los mismos envíos completos en todas las páginas", async () => {
    const grupos = await agrupar(db, { programId, rango: RANGO, agruparPor: ["utm_source", "utm_medium", "categoria"] });
    const { lista, filas } = await todasLasFilas();
    expect(grupos.reduce((total, grupo) => total + grupo.envios, 0)).toBe(53);
    expect(lista.subtotal.cantidad).toBe(53);
    expect(filas).toHaveLength(53);
    expect(lista.filas).toHaveLength(TAMANO_PAGINA);
  });

  it.each([
    [{ source: "facebook", medium: "cpc" }, { utm_source: ["facebook"], utm_medium: ["cpc"] }],
    [{ source: null, medium: null, categoria: "sin_utm" as const }, { utm_source: [null], utm_medium: [null], categoria: ["sin_utm"] }],
    [{ categoria: "macro" as const }, { categoria: ["macro"] }],
  ])("los filtros de Origen conservan el mismo conteo (%o)", async (filtrosLista, filtrosHecho) => {
    const grupos = await agrupar(db, {
      programId,
      rango: RANGO,
      agruparPor: ["utm_source", "utm_medium", "categoria"],
      filtros: filtrosHecho,
    });
    const { lista, filas } = await todasLasFilas(filtrosLista);
    const total = grupos.reduce((cantidad, grupo) => cantidad + grupo.envios, 0);
    expect(lista.subtotal.cantidad).toBe(total);
    expect(filas).toHaveLength(total);
  });

  it("proyecta persona, closer y deal antes de entregar la lista al tablero", async () => {
    const { lista } = await todasLasFilas();
    const completa = proyectarParaTablero(lista, true);
    expect(completa.filas.find((fila) => fila.persona?.nombre === "Ana")?.persona).toMatchObject({ nombre: "Ana" });
    expect(completa.filas.find((fila) => fila.persona?.nombre === "Ana")?.dealId).not.toBeNull();

    const limitada = proyectarParaTablero(lista, false);
    for (const fila of [...limitada.filas, ...limitada.grupos]) {
      expect(fila).toMatchObject({ persona: null, closer: null, claveCloser: null, dealId: null });
    }
  });

  it("muestra el deal de la persona aunque no haya nacido de ese envío, sin duplicar la fila", async () => {
    const [persona] = await db.select({ id: leads.id }).from(leads).where(eq(leads.emailNormalizado, "persona-1@retia.test"));
    const [abierto] = await db.insert(deals).values({
      programId, leadId: persona.id, etapa: "calificado", createdAt: new Date("2026-10-05T10:00:00-05:00"),
    }).returning();
    await db.insert(deals).values({
      programId, leadId: persona.id, etapa: "cierre_perdido", createdAt: new Date("2026-10-20T10:00:00-05:00"),
    });

    const { lista, filas } = await todasLasFilas();
    const delaPersona = filas.filter((fila) => fila.persona?.leadId === persona.id);
    expect(delaPersona.map((fila) => [fila.dealId, fila.etapa])).toEqual([[abierto.id, "calificado"]]);
    expect(filas).toHaveLength(lista.subtotal.cantidad);
  });
});
