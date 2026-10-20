import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { MIN_PAGOS_TRAZA, saludDeFuente, saludDeFuentes } from "@/lib/queries/salud-fuentes";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
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
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(2), penultimo: hace(5), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("al_dia");
    expect(s.marcada).toBe(false);
  });

  it("pasadas 48 h sin envios queda sin respuestas", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(49), penultimo: hace(50), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("sin_respuestas");
    expect(s.marcada).toBe(true);
  });

  it("pasados 5 dias queda muerta", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(121), penultimo: null, sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("muerta");
    expect(s.marcada).toBe(true);
  });

  it("un envio despues de un hueco mayor al umbral quita la marca y avisa que volvio", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(70), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("volvio");
    expect(s.marcada).toBe(false);
  });

  it("tambien vuelve una fuente que estuvo muerta", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(200), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("volvio");
  });

  it("una fuente que nunca recibio se marca, sin inventarle una fecha", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: null, penultimo: null, sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("sin_envios");
    expect(s.marcada).toBe(true);
  });

  it("los umbrales son los de la fuente, no fijos", () => {
    const s = saludDeFuente(
      { umbralSinRespuestaHoras: 6, umbralMuertaHoras: 24, ultimo: hace(7), penultimo: hace(8), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null },
      AHORA,
    );
    expect(s.estado).toBe("sin_respuestas");
  });

  it("una fuente al dia con sobres pendientes tambien se marca", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 3, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("al_dia");
    expect(s.sobresPendientes).toBe(3);
    expect(s.marcada).toBe(true);
  });

  it("🩸 una fuente al dia con envios SIN CALIDAD tambien se marca (ADR 0069; el 29-sep de Tactical)", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 23, lecturaApi: null }, AHORA);
    expect(s.estado).toBe("al_dia");
    expect(s.sinCalidad).toBe(23);
    expect(s.marcada).toBe(true);
  });

  it("una fuente que no se lee por API no tiene lectura vieja", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null }, AHORA);
    expect(s.lecturaVieja).toBe(false);
  });

  it("una lectura de hace una hora sigue al dia y no marca la fuente", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 0, lecturaApi: { leidaEn: hace(1) } }, AHORA);
    expect(s.lecturaVieja).toBe(false);
    expect(s.marcada).toBe(false);
  });

  it("una lectura de hace exactamente dos horas esta vieja y marca la fuente", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 0, lecturaApi: { leidaEn: hace(2) } }, AHORA);
    expect(s.lecturaVieja).toBe(true);
    expect(s.marcada).toBe(true);
  });

  it("una fuente que nunca fue leida por la API esta vieja y marcada", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 0, lecturaApi: { leidaEn: null } }, AHORA);
    expect(s.lecturaVieja).toBe(true);
    expect(s.marcada).toBe(true);
  });

  it("una fuente al dia se marca cuando su lectura por API esta vieja", () => {
    const s = saludDeFuente({ ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 0, lecturaApi: { leidaEn: hace(3) } }, AHORA);
    expect(s.estado).toBe("al_dia");
    expect(s.lecturaVieja).toBe(true);
    expect(s.marcada).toBe(true);
  });
  it("marca la traza solo desde cinco pagos y cuando falta el id en mas de la mitad", () => {
    const base = { ...UMBRALES, ultimo: hace(1), penultimo: hace(2), sobresPendientes: 0, sinCalidad: 0, lecturaApi: null };
    expect(MIN_PAGOS_TRAZA).toBe(5);
    expect(saludDeFuente({ ...base, pagos: 4, pagosSinId: 4 }).trazaRota).toBe(false);
    expect(saludDeFuente({ ...base, pagos: 5, pagosSinId: 5 }).trazaRota).toBe(true);
    expect(saludDeFuente({ ...base, pagos: 5, pagosSinId: 2 }).trazaRota).toBe(false);
  });
});

describe("saludDeFuentes (contra la base)", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [p] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
      .returning();
    programId = p.id;
  });
  afterAll(async () => cerrar());

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
      { sourceId: id, programId, cuerpo: "{}", error: "fallo" }, // pendiente
      { sourceId: id, programId, cuerpo: "{}", error: "fallo", reprocesadoEn: hace(1) }, // ya reprocesado
      { sourceId: id, programId, cuerpo: "{}" }, // entro bien
    ]);

    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.ultimo?.getTime()).toBe(hace(1).getTime());
    expect(s.penultimo?.getTime()).toBe(hace(70).getTime());
    expect(s.sobresPendientes).toBe(1);
    expect(s.estado).toBe("volvio");
    expect(s.marcada).toBe(true);
  });

  it("cuenta los envios COMPLETOS del ultimo dia sin lead_quality (ADR 0069)", async () => {
    const id = await fuente("Typeform");
    await db.insert(submissions).values([
      { sourceId: id, token: "sin", createdAt: hace(1), leadQuality: null }, // cuenta
      { sourceId: id, token: "sin-2", createdAt: hace(2), leadQuality: null, calificacion: "setteo_no_calificado" }, // cuenta: el estado ya no importa
      { sourceId: id, token: "high", createdAt: hace(3), leadQuality: "High" }, // tiene calidad
      { sourceId: id, token: "low", createdAt: hace(3), leadQuality: "Low" }, // tiene calidad
      { sourceId: id, token: "viejo", createdAt: hace(30), leadQuality: null }, // fuera de la ventana
      { sourceId: id, token: "parcial", createdAt: hace(1), leadQuality: null, esParcial: true }, // un parcial no cuenta
    ]);
    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.sinCalidad).toBe(2);
    expect(s.marcada).toBe(true);
  });

  it("cuenta la cobertura de ids solo en envios pagos de la fuente y programa", async () => {
    const id = await fuente("Typeform");
    const [otroPrograma] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "otro",
      nombre: "Otro",
      ticketUsd: "900",
    }).returning();
    const [otraFuente] = await db.insert(sources).values({
      programId: otroPrograma.id,
      nombre: "Otra fuente",
      tipo: "webhook",
      proveedor: "typeform",
    }).returning();
    await db.insert(submissions).values([
      { sourceId: id, token: "ad", createdAt: hace(1), utmMedium: "paid", respuestas: { ad_id: "101" } },
      { sourceId: id, token: "utm", createdAt: hace(1), utmMedium: "cpc", utmId: "102" },
      { sourceId: id, token: "macro", createdAt: hace(1), utmMedium: "paid", utmId: "{{ad.id}}" },
      { sourceId: id, token: "vacio", createdAt: hace(1), utmMedium: "paid" },
      { sourceId: id, token: "organico", createdAt: hace(1), utmMedium: "organic" },
      { sourceId: otraFuente.id, token: "otro", createdAt: hace(1), utmMedium: "paid" },
    ]);

    const salud = await saludDeFuentes(db, AHORA);
    const s = salud.find((fila) => fila.sourceId === id)!;
    expect(s).toMatchObject({ pagos: 4, pagosSinId: 2, pagosIdDesconocido: 2, trazaRota: false });
  });

  it("solo mira las fuentes activas", async () => {
    await fuente("Vieja", false);
    expect(await saludDeFuentes(db, AHORA)).toEqual([]);
  });

  it("marca una fuente Form30x cuya ultima lectura fue hace tres horas", async () => {
    const id = await fuente("Form30x", true, {
      proveedor: "form30x",
      form30xFormId: "form-sbj",
      form30xLeidoEn: hace(3),
    });
    await db.insert(submissions).values({ sourceId: id, token: "reciente", createdAt: hace(1), leadQuality: "High" });

    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.lecturaApi?.leidaEn?.getTime()).toBe(hace(3).getTime());
    expect(s.lecturaVieja).toBe(true);
    expect(s.marcada).toBe(true);
  });

  it("no marca por lectura una fuente Form30x leida hace treinta minutos", async () => {
    const id = await fuente("Form30x", true, {
      proveedor: "form30x",
      form30xFormId: "form-sbj",
      form30xLeidoEn: hace(0.5),
    });
    await db.insert(submissions).values({ sourceId: id, token: "reciente", createdAt: hace(1), leadQuality: "High" });

    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.lecturaVieja).toBe(false);
    expect(s.marcada).toBe(false);
  });

  it("una fuente Typeform no expone lectura por API", async () => {
    await fuente("Typeform");
    const [s] = await saludDeFuentes(db, AHORA);
    expect(s.lecturaApi).toBeNull();
    expect(s.lecturaVieja).toBe(false);
  });
});
