import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { leads, programs, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { deduplicarPorCorreo } from "@/lib/sheets/dedup";
import { parsearFecha, ZonaHorariaInvalidaError, ZONA_BOGOTA } from "@/lib/sheets/mapeo";
import { sincronizarPersonas } from "@/lib/sheets/sync";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 053: una celda de fecha se lee con la zona DE SU FUENTE (`sources.tz_fechas`).
 *
 * 🩸 Typeform escribe `Submitted At` en UTC, y se parseaba como si fuera de Bogota:
 * cada fecha quedaba cinco horas corrida, y de 7pm a medianoche el lead caia en el
 * dia siguiente del embudo, sin un solo error. Evidencia en
 * `docs/insumos/notas-segundo-cerebro/flujo-de-leads-y-closers-retia.md` (una fila con
 * `Submitted At` 16/9 23:05 sellada por el Apps Script a las 18:08 de Bogota) y en los
 * consolidados C2, que solo cuadran con la pestana Urgencias restando cinco horas.
 */
describe("parsearFecha con la zona de la fuente", () => {
  it("la misma celda da instantes distintos en UTC y en Bogota: cinco horas", () => {
    const enUtc = parsearFecha("16/9/2026 23:05:00", "UTC")!;
    const enBogota = parsearFecha("16/9/2026 23:05:00", ZONA_BOGOTA)!;

    expect(enUtc.toISOString()).toBe("2026-09-16T23:05:00.000Z");
    expect(enBogota.toISOString()).toBe("2026-09-17T04:05:00.000Z");
    expect(enBogota.getTime() - enUtc.getTime()).toBe(5 * 60 * 60 * 1000);
  });

  it("sin zona sigue siendo Bogota: el comportamiento de hoy no cambia por defecto", () => {
    expect(parsearFecha("7/8/2026 14:30:00")!.toISOString()).toBe(
      parsearFecha("7/8/2026 14:30:00", ZONA_BOGOTA)!.toISOString(),
    );
  });

  it("una fecha sin hora en UTC es la medianoche UTC de ese dia", () => {
    expect(parsearFecha("3/12/2026", "UTC")!.toISOString()).toBe("2026-12-03T00:00:00.000Z");
  });

  it("respeta el horario de verano de una zona que lo tiene", () => {
    // Nueva York: UTC-4 en julio, UTC-5 en enero. Bogota no tiene, pero una fuente si podria.
    expect(parsearFecha("1/7/2026 12:00:00", "America/New_York")!.toISOString()).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(parsearFecha("15/1/2026 12:00:00", "America/New_York")!.toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
  });

  it("el centinela sigue siendo null en cualquier zona", () => {
    expect(parsearFecha("1/1/0001 0:00:00", "UTC")).toBeNull();
    expect(parsearFecha("30/12/1899", "UTC")).toBeNull();
  });

  it("una zona que no existe falla ruidosamente, no se adivina", () => {
    expect(() => parsearFecha("16/9/2026 23:05:00", "America/Medellin")).toThrow(
      ZonaHorariaInvalidaError,
    );
    // Ni siquiera con una celda vacia: la configuracion rota se reporta igual.
    expect(() => parsearFecha("", "Bogota")).toThrow(ZonaHorariaInvalidaError);
  });
});

describe("el dedup lee cada fila con la zona de su fuente", () => {
  it("ordena primera y ultima aplicacion con el instante real, no con el texto", () => {
    // La fila A es de una fuente en UTC y la B de una en Bogota. Leidas las dos como
    // Bogota, A (23:05) parece POSTERIOR a B (20:00). En realidad A fue a las 18:05 de
    // Bogota, ANTES que B.
    const a = { emailNormalizado: "x@correo.co", fechaAplicacion: "16/9/2026 23:05:00" };
    const b = { emailNormalizado: "x@correo.co", fechaAplicacion: "16/9/2026 20:00:00" };
    const zonas = new Map<object, string>([
      [a, "UTC"],
      [b, ZONA_BOGOTA],
    ]);

    const { personas } = deduplicarPorCorreo([a, b], (fila) => zonas.get(fila) ?? ZONA_BOGOTA);

    expect(personas[0].fechaPrimeraAplicacion!.toISOString()).toBe("2026-09-16T23:05:00.000Z");
    expect(personas[0].fechaUltimaAplicacion!.toISOString()).toBe("2026-09-17T01:00:00.000Z");
    // `raw` es la fila mas reciente de verdad.
    expect(personas[0].raw).toBe(b);
  });

  it("sin funcion de zona, todo es Bogota como antes", () => {
    const { personas } = deduplicarPorCorreo([
      { emailNormalizado: "y@correo.co", fechaAplicacion: "12/8/2026 19:30:00" },
    ]);
    expect(personas[0].fechaPrimeraAplicacion!.toISOString()).toBe("2026-08-13T00:30:00.000Z");
  });
});

// ---- El sync de punta a punta, con la base real de migraciones (PGlite) ----

const matrices = new Map<string, string[][]>();

vi.mock("@/lib/sheets/leer", () => ({
  leerPestana: vi.fn(async (sheetId: string, tab: string) => matrices.get(`${sheetId}|${tab}`) ?? []),
}));

let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => {
  matrices.clear();
  ({ db, cerrar } = await crearBaseDePrueba());
});

afterEach(async () => {
  await cerrar();
});

async function programaConFuente(tzFechas?: string): Promise<string> {
  const [p] = await db
    .insert(programs)
    .values({ slug: "programa-zona", nombre: "Programa zona", ticketUsd: "1000" })
    .returning();
  await db.insert(sources).values({
    programId: p.id,
    nombre: "Formulario",
    tipo: "google_sheet",
    sheetId: "sheet-zona",
    tab: "Respuestas",
    orden: 1,
    ...(tzFechas ? { tzFechas } : {}),
  });
  matrices.set("sheet-zona|Respuestas", [
    ["correo electronico", "submitted at"],
    ["lead@correo.co", "16/9/2026 23:05:00"],
  ]);
  return p.id;
}

describe("el sync usa sources.tz_fechas", () => {
  it("una fuente en UTC guarda el instante UTC de la celda", async () => {
    const programId = await programaConFuente("UTC");
    await sincronizarPersonas(programId, db);

    const [lead] = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(lead.fechaPrimeraAplicacion!.toISOString()).toBe("2026-09-16T23:05:00.000Z");
  });

  it("una fuente sin configurar sigue en Bogota (el default de la columna)", async () => {
    const programId = await programaConFuente();
    await sincronizarPersonas(programId, db);

    const [lead] = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(lead.fechaPrimeraAplicacion!.toISOString()).toBe("2026-09-17T04:05:00.000Z");
  });

  it("una zona invalida en la fuente hace fallar el sync y no escribe leads", async () => {
    const programId = await programaConFuente("Hora de Bogota");
    const resultado = await sincronizarPersonas(programId, db).catch((e) => e);

    const escritos = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(escritos).toHaveLength(0);
    // Sea que lance o que devuelva el error en el resultado, tiene que nombrar la zona.
    expect(JSON.stringify(resultado instanceof Error ? resultado.message : resultado)).toContain(
      "Hora de Bogota",
    );
  });
});
