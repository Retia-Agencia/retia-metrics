import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { saludDeFuente, saludDeFuentes } from "@/lib/queries/salud-fuentes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 107: una fuente que dejo de recibir se ve en la app. Umbrales de Mani
 * (28-sep): 48 h sin envios la marca "sin respuestas", 5 dias "muerta", y un envio
 * que llega despues de la marca la quita con un aviso de que volvio.
 */

const AHORA = new Date("2026-09-28T20:00:00Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);
const UMBRALES = { umbralSinRespuestaHoras: 48, umbralMuertaHoras: 120 };

describe("saludDeFuente (pura)", () => {
  it("con un envio reciente esta al dia", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(2), penultimo: hace(5), sobresPendientes: 0 }, AHORA);
    expect(s.estado).toBe("al_dia");
    expect(s.marcada).toBe(false);
  });

  it("pasadas 48 h sin envios queda sin respuestas", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(49), penultimo: hace(50), sobresPendientes: 0 }, AHORA);
    expect(s.estado).toBe("sin_respuestas");
    expect(s.marcada).toBe(true);
  });

  it("pasados 5 dias queda muerta", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(121), penultimo: null, sobresPendientes: 0 }, AHORA);
    expect(s.estado).toBe("muerta");
    expect(s.marcada).toBe(true);
  });

  it("un envio despues de un hueco mayor al umbral quita la marca y avisa que volvio", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(70), sobresPendientes: 0 }, AHORA);
    expect(s.estado).toBe("volvio");
    expect(s.marcada).toBe(false);
  });

  it("tambien vuelve una fuente que estuvo muerta", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(200), sobresPendientes: 0 }, AHORA);
    expect(s.estado).toBe("volvio");
  });

  it("una fuente que nunca recibio se marca, sin inventarle una fecha", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: null, penultimo: null, sobresPendientes: 0 }, AHORA);
    expect(s.estado).toBe("sin_envios");
    expect(s.marcada).toBe(true);
  });

  it("los umbrales son los de la fuente, no fijos", () => {
    const s = saludDeFuente(
      { umbralSinRespuestaHoras: 6, umbralMuertaHoras: 24, ultimo: hace(7), penultimo: hace(8), sobresPendientes: 0 },
      AHORA,
    );
    expect(s.estado).toBe("sin_respuestas");
  });

  it("una fuente al dia con sobres pendientes tambien se marca", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 3 }, AHORA);
    expect(s.estado).toBe("al_dia");
    expect(s.sobresPendientes).toBe(3);
    expect(s.marcada).toBe(true);
  });
});

describe("saludDeFuentes (contra la base)", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
      .returning();
    programId = p.id;
  });
  afterEach(async () => cerrar());

  async function fuente(nombre: string, activo = true, extra: Partial<typeof sources.$inferInsert> = {}) {
    // Una sola fuente ACTIVA por programa (ADR 0039): las demas nacen inactivas.
    const [f] = await db
      .insert(sources)
      .values({ programId, nombre, tipo: "webhook", proveedor: "typeform", activo, ...extra })
      .returning();
    return f.id;
  }

  it("la fuente nueva nace con los umbrales por defecto de Mani", async () => {
    const id = await fuente("Typeform");
    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.sourceId).toBe(id);
    expect(s.umbralSinRespuestaHoras).toBe(48);
    expect(s.umbralMuertaHoras).toBe(120);
  });

  it("la base rechaza un umbral de muerta que no supera al de sin respuestas", async () => {
    await expect(fuente("Mala", true, { umbralSinRespuestaHoras: 48, umbralMuertaHoras: 48 })).rejects.toThrow();
    await expect(fuente("Cero", false, { umbralSinRespuestaHoras: 0, umbralMuertaHoras: 10 })).rejects.toThrow();
  });

  it("lee el ultimo y el penultimo envio de cada fuente y cuenta solo los sobres pendientes", async () => {
    const id = await fuente("Typeform");
    await db.insert(submissions).values([
      { sourceId: id, token: "a", createdAt: hace(70) },
      { sourceId: id, token: "b", createdAt: hace(90) },
      { sourceId: id, token: "c", createdAt: hace(1) },
    ]);
    await db.insert(sobresCrudos).values([
      { sourceId: id, cuerpo: "{}", error: "fallo" }, // pendiente
      { sourceId: id, cuerpo: "{}", error: "fallo", reprocesadoEn: hace(1) }, // ya reprocesado
      { sourceId: id, cuerpo: "{}" }, // entro bien
    ]);

    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.ultimo?.getTime()).toBe(hace(1).getTime());
    expect(s.penultimo?.getTime()).toBe(hace(70).getTime());
    expect(s.sobresPendientes).toBe(1);
    expect(s.estado).toBe("volvio");
    expect(s.marcada).toBe(true);
  });

  it("solo mira las fuentes activas", async () => {
    await fuente("Vieja", false);
    expect(await saludDeFuentes(db, AHORA)).toEqual([]);
  });
});
