import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearFuente, editarFuente, guardarTokenTypeform, listarFuentes } from "@/lib/catalogo/fuentes";
import { fuentesParaAdmin } from "@/lib/queries/fuentes";
import { embudoPorPregunta, vaciarCacheDeInsights, CACHE_INSIGHTS_MS } from "@/lib/queries/embudo-por-pregunta";
import { formIdDeTypeform, interpretarInsights, leerInsights, type FetchLike } from "@/lib/typeform/insights";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 126 parte B: el embudo por pregunta desde el Insights de Typeform. Lo que muerde:
 *  - El token vive en la fuente con las reglas del secreto (decision de Mani, 29-sep): lo
 *    escribe solo `guardarTokenTypeform`, no sale en ninguna lectura ni en `change_log`, y
 *    editar la fuente por el molde no lo pisa.
 *  - El Insights se lee en vivo, se valida la forma, y un token rechazado se VE (no es un
 *    embudo vacio). Caché corta por fuente; un error no se cachea.
 */

vi.mock("@/lib/sheets/leer", () => ({ leerPestana: vi.fn(async () => []) }));

const TOKEN = "tfp_token-de-prueba-que-no-debe-salir";
const URL_FORM = "https://postulacioness.typeform.com/to/GmPGBOf9?utm_source=xxxxx";

/** La forma real medida el 6-oct, recortada. */
const SUMMARY = {
  form: { summary: { unique_visits: 4789, responses_count: 3269, completion_rate: 68.3 } },
  fields: [
    { id: "a", title: "¿Cuál es tu nombre completo?", type: "short_text", views: 8428, dropoffs: 3518 },
    { id: "b", title: "¿Cuál es tu correo electrónico?", type: "email", views: 4910, dropoffs: 271 },
    { id: "c", title: "Agenda aquí tu entrevista", type: "calendly", views: 943, dropoffs: 415 },
  ],
};

function fetchQueResponde(status: number, cuerpo: unknown = SUMMARY) {
  return vi.fn<FetchLike>(async () => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo }));
}

describe("el id del formulario sale de su URL publica", () => {
  it("lee /to/<id> e ignora los parametros", () => {
    expect(formIdDeTypeform(URL_FORM)).toBe("GmPGBOf9");
    expect(formIdDeTypeform("https://form.typeform.com/to/E5F4chVT")).toBe("E5F4chVT");
  });
  it("sin URL, con otro dominio o con otra forma no adivina", () => {
    expect(formIdDeTypeform(null)).toBeNull();
    expect(formIdDeTypeform("https://typeform.com.evil.io/to/abc")).toBeNull();
    expect(formIdDeTypeform("https://x.typeform.com/forms/abc")).toBeNull();
    expect(formIdDeTypeform("no es url")).toBeNull();
  });
});

describe("leer el Insights", () => {
  it("devuelve las preguntas en orden con vistas y abandonos", async () => {
    const f = fetchQueResponde(200);
    const r = await leerInsights({ token: TOKEN, formId: "GmPGBOf9", fetch: f });
    expect(r).toMatchObject({ formId: "GmPGBOf9", visitasUnicas: 4789, respuestas: 3269 });
    expect(r.preguntas.map((p) => [p.id, p.vistas, p.abandonos])).toEqual([
      ["a", 8428, 3518],
      ["b", 4910, 271],
      ["c", 943, 415],
    ]);
    expect(f.mock.calls[0][0]).toBe("https://api.typeform.com/insights/GmPGBOf9/summary");
    expect(f.mock.calls[0][1]?.headers?.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("un token rechazado lanza, no devuelve un embudo vacio", async () => {
    await expect(leerInsights({ token: TOKEN, formId: "x", fetch: fetchQueResponde(401) })).rejects.toThrow(/token/);
    await expect(leerInsights({ token: TOKEN, formId: "x", fetch: fetchQueResponde(500) })).rejects.toThrow(/500/);
  });

  it("una forma inesperada lanza", () => {
    expect(() => interpretarInsights("x", { fields: [] })).toThrow();
    expect(() =>
      interpretarInsights("x", { form: { summary: { unique_visits: 1, responses_count: 1 } }, fields: [{ id: "a" }] }),
    ).toThrow();
  });
});

describe("con base", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let gerenteId: string;
  let closerId: string;
  const gerente = () => ({ id: gerenteId, rol: "gerente" as const });

  beforeEach(async () => {
    vaciarCacheDeInsights();
    ({ db, cerrar } = await crearBaseDePrueba());
    const [g] = await db.insert(users).values({ email: "g@retiagrowth.com", rol: "gerente", nombre: "G" }).returning();
    gerenteId = g.id;
    const [c] = await db
      .insert(users)
      .values({ email: "c@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
      .returning();
    closerId = c.id;
    const [p] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa", nombre: "Programa", ticketUsd: "1000" })
      .returning();
    programId = p.id;
  });

  afterEach(async () => {
    await cerrar();
  });

  async function fuenteTypeform(urlPublica: string | null = URL_FORM) {
    const f = await crearFuente(db, gerente(), {
      programId,
      nombre: "Typeform Tactical",
      tipo: "webhook",
      proveedor: "typeform",
      urlPublica,
    });
    await db.update(sources).set({ activo: true }).where(eq(sources.id, f.id));
    return f;
  }

  describe("el token", () => {
    it("se guarda, y no sale en el catalogo, en la pantalla ni en change_log", async () => {
      const f = await fuenteTypeform();
      expect(f.tieneTokenTypeform).toBe(false);
      await guardarTokenTypeform(db, gerente(), f.id, `  ${TOKEN}  `);
      const [fila] = await db.select({ t: sources.typeformToken }).from(sources).where(eq(sources.id, f.id));
      expect(fila.t).toBe(TOKEN);

      const lista = await listarFuentes(db, programId);
      expect(JSON.stringify(lista)).not.toContain(TOKEN);
      expect(lista[0].tieneTokenTypeform).toBe(true);
      const { fuentes } = await fuentesParaAdmin(db);
      expect(JSON.stringify(fuentes)).not.toContain(TOKEN);
      expect(fuentes[0]).toMatchObject({ tieneTokenTypeform: true });
      expect("typeformToken" in fuentes[0]).toBe(false);

      const log = await db.select().from(changeLog).where(eq(changeLog.registroId, f.id));
      expect(JSON.stringify(log)).not.toContain(TOKEN);
      expect(log.find((l) => l.campo === "typeform_token")).toMatchObject({
        valorAnterior: null,
        valorNuevo: "(oculto)",
        userId: gerenteId,
      });
    });

    it("editar la fuente por el molde no lo pisa ni lo filtra", async () => {
      const f = await fuenteTypeform();
      await guardarTokenTypeform(db, gerente(), f.id, TOKEN);
      const editada = await editarFuente(db, gerente(), f.id, {
        programId,
        nombre: "Otro nombre",
        tipo: "webhook",
        proveedor: "typeform",
        urlPublica: URL_FORM,
      });
      expect(JSON.stringify(editada)).not.toContain(TOKEN);
      const [fila] = await db.select({ t: sources.typeformToken }).from(sources).where(eq(sources.id, f.id));
      expect(fila.t).toBe(TOKEN);
      const log = await db.select().from(changeLog).where(eq(changeLog.registroId, f.id));
      expect(JSON.stringify(log)).not.toContain(TOKEN);
    });

    it("un closer no lo guarda (403) y la base no se mueve", async () => {
      const f = await fuenteTypeform();
      await expect(
        guardarTokenTypeform(db, { id: closerId, rol: "closer" }, f.id, TOKEN),
      ).rejects.toMatchObject({ status: 403 });
      const [fila] = await db.select({ t: sources.typeformToken }).from(sources).where(eq(sources.id, f.id));
      expect(fila.t).toBeNull();
    });

    it("solo una fuente de Typeform lo tiene (422); vacio es 400", async () => {
      const dapta = await crearFuente(db, gerente(), { programId, nombre: "Dapta", tipo: "webhook", proveedor: "dapta" });
      await expect(guardarTokenTypeform(db, gerente(), dapta.id, TOKEN)).rejects.toMatchObject({ status: 422 });
      const f = await fuenteTypeform();
      await expect(guardarTokenTypeform(db, gerente(), f.id, "   ")).rejects.toMatchObject({ status: 400 });
    });
  });

  describe("el embudo por pregunta del programa", () => {
    it("sin token o sin URL lo dice; con los dos lee, y el token no sale", async () => {
      const sinToken = await fuenteTypeform();
      let r = await embudoPorPregunta(db, programId, { fetch: fetchQueResponde(200) });
      expect(r).toEqual([{ fuenteId: sinToken.id, fuente: "Typeform Tactical", estado: "sin_token" }]);

      await guardarTokenTypeform(db, gerente(), sinToken.id, TOKEN);
      await db.update(sources).set({ urlPublica: null }).where(eq(sources.id, sinToken.id));
      r = await embudoPorPregunta(db, programId, { fetch: fetchQueResponde(200) });
      expect(r[0].estado).toBe("sin_url");

      await db.update(sources).set({ urlPublica: URL_FORM }).where(eq(sources.id, sinToken.id));
      r = await embudoPorPregunta(db, programId, { fetch: fetchQueResponde(200) });
      expect(r[0]).toMatchObject({ estado: "ok", insights: { formId: "GmPGBOf9", respuestas: 3269 } });
      expect(JSON.stringify(r)).not.toContain(TOKEN);
    });

    it("solo lee fuentes activas de Typeform del programa", async () => {
      const f = await fuenteTypeform();
      await guardarTokenTypeform(db, gerente(), f.id, TOKEN);
      await db.update(sources).set({ activo: false }).where(eq(sources.id, f.id));
      await crearFuente(db, gerente(), { programId, nombre: "Dapta", tipo: "webhook", proveedor: "dapta" });
      expect(await embudoPorPregunta(db, programId, { fetch: fetchQueResponde(200) })).toEqual([]);
    });

    it("un token rechazado se ve como error, y el error no se cachea", async () => {
      const f = await fuenteTypeform();
      await guardarTokenTypeform(db, gerente(), f.id, TOKEN);
      const r = await embudoPorPregunta(db, programId, { fetch: fetchQueResponde(401) });
      expect(r[0]).toMatchObject({ estado: "error", mensaje: expect.stringMatching(/token/) });
      const bien = fetchQueResponde(200);
      expect((await embudoPorPregunta(db, programId, { fetch: bien }))[0].estado).toBe("ok");
      expect(bien).toHaveBeenCalledTimes(1);
    });

    it("cachea 5 minutos por fuente y despues vuelve a leer", async () => {
      const f = await fuenteTypeform();
      await guardarTokenTypeform(db, gerente(), f.id, TOKEN);
      const fetch = fetchQueResponde(200);
      const t0 = new Date("2026-10-06T15:00:00Z");
      await embudoPorPregunta(db, programId, { ahora: t0, fetch });
      const enCache = await embudoPorPregunta(db, programId, {
        ahora: new Date(t0.getTime() + CACHE_INSIGHTS_MS - 1),
        fetch,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(enCache[0]).toMatchObject({ estado: "ok", leidoEn: t0 });
      await embudoPorPregunta(db, programId, { ahora: new Date(t0.getTime() + CACHE_INSIGHTS_MS), fetch });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("reemplazar el token invalida la caché", async () => {
      const f = await fuenteTypeform();
      await guardarTokenTypeform(db, gerente(), f.id, TOKEN);
      const fetch = fetchQueResponde(200);
      const t0 = new Date("2026-10-06T15:00:00Z");
      await embudoPorPregunta(db, programId, { ahora: t0, fetch });
      await guardarTokenTypeform(db, gerente(), f.id, "otro-token");
      const r = await embudoPorPregunta(db, programId, { ahora: t0, fetch: fetchQueResponde(401) });
      expect(r[0].estado).toBe("error");
    });
  });
});
