import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, cohorts, objetivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 378: el panel «Configuración» de Hoy guarda por las acciones de siempre
 * (`editarCohorteAccion`, `guardarObjetivoAccion`/`quitarObjetivoAccion`, `editarProgramaAccion`).
 * Aquí se prueba con el MISMO cuerpo que arma el panel (textos de los inputs): cada campo deja su
 * `change_log`, y una petición forjada sin administración responde error sin mover la base.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
let db: Db;
vi.mock("@/lib/db", () => ({ get db() { return db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;
let programId: string;
let cohortId: string;

const sesion = (rol: string, id: string) => ({ user: { id, email: `${rol}@retia.test`, rol, closerId: null, alcanceLimitado: false } });

beforeAll(async () => { ({ db, cerrar, vaciar } = await crearBaseReutilizable()); });
afterAll(async () => { await cerrar(); });

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  const [g] = await db.insert(users).values({ email: "gerente@retia.test", rol: "gerente", nombre: "G" }).returning();
  gerenteId = g.id;
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "hoy-a", nombre: "Hoy A", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 50, metaLeadsDia: null, precioUsd: "797.00",
    fechaInicioClases: "2026-11-20", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-11-06", estado: "activo",
  }).returning();
  cohortId = c.id;
});

/** El cuerpo que arma el panel: la fila de la cohorte más los textos de sus campos. */
const cuerpoDelPanel = (extra: Record<string, unknown>) => ({
  programId, codigo: "C1", metaCupos: "50", metaLeadsDia: null, precioUsd: "797.00",
  fechaInicioClases: "2026-11-20", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-11-06", estado: "activo" as const,
  ...extra,
});
const objetivoDelPanel = (extra: Record<string, unknown> = {}) => ({
  cohortId, area: null, metrica: "conversion_agenda_venta" as const, meta: "25", aceptable: null, ...extra,
});
const rastro = (campo: string) => db.select().from(changeLog).where(and(eq(changeLog.tabla, "cohorts"), eq(changeLog.campo, campo)));

describe("378: guardar los supuestos de Hoy", () => {
  it("meta de cupos, cierre de ventas y meta de leads por día se guardan y cada campo deja su rastro", async () => {
    auth.mockResolvedValue(sesion("gerente", gerenteId));
    const { editarCohorteAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");
    const res = await editarCohorteAccion("hoy-a", cohortId, cuerpoDelPanel({ metaCupos: "60", metaLeadsDia: "120", fechaCierreVentas: "2026-11-13" }));
    expect(res).toEqual({ ok: true });
    const [c] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId));
    expect(c).toMatchObject({ metaCupos: 60, metaLeadsDia: 120, fechaCierreVentas: "2026-11-13" });
    for (const campo of ["metaCupos", "metaLeadsDia", "fechaCierreVentas"]) {
      expect(await rastro(campo), campo).toHaveLength(1);
    }
    expect((await rastro("metaLeadsDia"))[0]).toMatchObject({ valorAnterior: null, valorNuevo: "120", userId: gerenteId });
  });

  it("vaciar la meta de leads la deja en nulo (la pantalla dice —), no en cero", async () => {
    auth.mockResolvedValue(sesion("gerente", gerenteId));
    const { editarCohorteAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");
    await editarCohorteAccion("hoy-a", cohortId, cuerpoDelPanel({ metaLeadsDia: "80" }));
    await editarCohorteAccion("hoy-a", cohortId, cuerpoDelPanel({ metaLeadsDia: null }));
    const [c] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId));
    expect(c.metaLeadsDia).toBeNull();
  });

  it("el objetivo se crea, se edita y se quita (vacío en el panel), siempre con rastro", async () => {
    auth.mockResolvedValue(sesion("gerente", gerenteId));
    const { guardarObjetivoAccion, quitarObjetivoAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-objetivos");
    expect(await guardarObjetivoAccion(objetivoDelPanel())).toEqual({ ok: true });
    const [creado] = await db.select().from(objetivos).where(eq(objetivos.cohortId, cohortId));
    expect(await guardarObjetivoAccion(objetivoDelPanel({ id: creado.id, meta: "30" }))).toEqual({ ok: true });
    expect(Number((await db.select().from(objetivos).where(eq(objetivos.id, creado.id)))[0].meta)).toBe(30);
    expect(await quitarObjetivoAccion(creado.id)).toEqual({ ok: true });
    expect(await db.select().from(objetivos).where(eq(objetivos.cohortId, cohortId))).toHaveLength(0);
    expect((await db.select().from(changeLog).where(eq(changeLog.registroId, creado.id))).length).toBeGreaterThanOrEqual(3);
  });
});

describe("378: una petición forjada sin administración no mueve nada", () => {
  it.each(["closer", "paid_trafficker", "customer_success"])("%s es rechazado en cohorte, objetivo y programa", async (rol) => {
    auth.mockResolvedValue(sesion(rol, "u-forjado"));
    const { editarCohorteAccion, editarProgramaAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-programa");
    const { guardarObjetivoAccion } = await import("@/app/(app)/p/[programa]/programa/acciones-objetivos");
    const [p] = await db.select().from(programs).where(eq(programs.id, programId));

    expect((await editarCohorteAccion("hoy-a", cohortId, cuerpoDelPanel({ metaCupos: "999", metaLeadsDia: "999", fechaCierreVentas: "2027-01-01" }))).ok).toBe(false);
    expect((await guardarObjetivoAccion(objetivoDelPanel({ metrica: "conversion_agenda_venta", meta: "99" }))).ok).toBe(false);
    expect((await editarProgramaAccion(programId, {
      nombre: p.nombre, slug: p.slug, ticketUsd: String(p.ticketUsd), webUrl: "", calendlyUrl: "", muestraMinimaConversion: 99,
    })).ok).toBe(false);

    const [c] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId));
    expect(c).toMatchObject({ metaCupos: 50, metaLeadsDia: null, fechaCierreVentas: "2026-11-06" });
    expect(await db.select().from(objetivos).where(eq(objetivos.cohortId, cohortId))).toHaveLength(0);
    expect((await db.select().from(programs).where(eq(programs.id, programId)))[0].muestraMinimaConversion).toBe(p.muestraMinimaConversion);
  });
});

describe("378: la meta de leads del día y de la semana sale de UNA función (N1)", () => {
  it("las tarjetas de Hoy usan metaDeLeads y ninguna lee metaLeadsDia por su cuenta", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const carpeta = "components/dashboard/hoy";
    const archivos = readdirSync(carpeta).filter((f) => f.endsWith(".tsx"));
    const usan = archivos.filter((f) => readFileSync(`${carpeta}/${f}`, "utf8").includes("metaDeLeads("));
    expect(usan.sort()).toEqual(["cifras-clave.tsx", "semana.tsx"]);
    for (const f of archivos) expect(readFileSync(`${carpeta}/${f}`, "utf8"), f).not.toMatch(/\.metaLeadsDia/);
  });
});
