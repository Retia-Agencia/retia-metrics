import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import arbol from "./fixtures/meta/arbol.json";
import insights from "./fixtures/meta/insights.json";
import ajustados from "./fixtures/meta/insights-ajustados.json";
import vacios from "./fixtures/meta/insights-vacios.json";
import {
  cuentasPublicitarias,
  gastoPauta,
  metaConexiones,
  pautaObjetos,
  pautaSincronizaciones,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { MINUTOS_PARA_CORRIDA_CORTADA, sincronizarPauta } from "@/lib/pauta/sincronizar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const TOKEN = "token-super-secreto";
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

function fetchMeta(
  datosInsights: unknown = insights,
  opciones: { actualizadoEn?: string; fallarCuenta?: string } = {},
) {
  return vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    expect(url.toString()).not.toContain(TOKEN);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    if (opciones.fallarCuenta && url.pathname.includes(`/act_${opciones.fallarCuenta}/`)) {
      return Response.json({ error: { message: `falló ${TOKEN}` } }, { status: 500 });
    }
    const borde = url.pathname.split("/").at(-1);
    if (borde === "campaigns" || borde === "adsets") {
      return Response.json({ data: arbol[borde] });
    }
    if (borde === "ads" && url.searchParams.has("filtering")) {
      expect(url.searchParams.get("fields"))
        .toBe("id,creative{object_type,video_id,asset_feed_spec,url_tags}");
      return Response.json({ data: arbol.creatives });
    }
    if (borde === "ads") {
      expect(url.searchParams.get("fields"))
        .toBe("id,name,effective_status,adset_id,campaign_id,url_tags,updated_time");
      expect(url.searchParams.get("limit")).toBe("500");
      return Response.json({
        data: arbol.ads.map((anuncio) => ({
          ...anuncio,
          updated_time: opciones.actualizadoEn ?? anuncio.updated_time,
        })),
      });
    }
    if (borde === "insights") return Response.json(datosInsights);
    return Response.json({ error: { message: "ruta inesperada" } }, { status: 404 });
  });
}

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: "programa-pauta", nombre: "Programa pauta", ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  await db.insert(metaConexiones).values({ nombre: "Retia", tokenSecreto: TOKEN });
  await db.insert(cuentasPublicitarias).values({
    idMeta: "123", programId, nombre: "Cuenta", moneda: "COP", zonaHoraria: "America/Bogota",
  });
});

afterAll(async () => cerrar());

describe("sincronización de pauta", () => {
  it("es idempotente y una corrección de Meta actualiza el día", async () => {
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f: fetchMeta() });
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f: fetchMeta(ajustados) });
    const gastos = await db.select().from(gastoPauta);
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ monto: "135.25", agendasMeta: 4, programId });
  });

  it("una segunda corrida sin cambios conserva el formato y no vuelve a pedir el creativo", async () => {
    const f = fetchMeta();
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f });
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f });
    const llamadasCreativo = f.mock.calls.filter(([entrada]) =>
      new URL(entrada instanceof Request ? entrada.url : String(entrada)).searchParams.has("filtering"));
    expect(llamadasCreativo).toHaveLength(1);
    const [anuncio] = await db.select().from(pautaObjetos)
      .where(eq(pautaObjetos.nivel, "anuncio"));
    expect(anuncio).toMatchObject({ formato: "video", urlTags: "utm_id={{ad.id}}" });
  });

  it("vuelve a pedir el creativo de un anuncio cuyo updated_time avanzó", async () => {
    await sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f: fetchMeta(),
    });
    const f = fetchMeta(insights, { actualizadoEn: "2099-10-14T12:00:00-05:00" });
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f });
    expect(f.mock.calls.filter(([entrada]) =>
      new URL(entrada instanceof Request ? entrada.url : String(entrada)).searchParams.has("filtering")))
      .toHaveLength(1);
  });

  it("una cuenta que falla no impide que otra escriba", async () => {
    const [otroPrograma] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: "programa-dos", nombre: "Programa dos", ticketUsd: "1000",
    }).returning();
    await db.insert(cuentasPublicitarias).values({
      idMeta: "456", programId: otroPrograma.id, nombre: "Cuenta sana", moneda: "COP",
      zonaHoraria: "America/Bogota",
    });
    const resumen = await sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "cron",
      f: fetchMeta(insights, { fallarCuenta: "123" }),
    });
    expect(resumen).toMatchObject({ estado: "error", filas: 1, omitidas: 1 });
    expect(resumen.error).toContain("Cuenta: Meta rechazó la consulta");
    expect(resumen.error).toContain("(oculto)");
    expect(await db.select().from(gastoPauta)).toHaveLength(1);
    expect((await db.select().from(gastoPauta))[0].programId).toBe(otroPrograma.id);
  });

  it("omite un anuncio que no pertenece al árbol de esa cuenta", async () => {
    const [otroPrograma] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: "otro-programa", nombre: "Otro", ticketUsd: "1000",
    }).returning();
    const [otraCuenta] = await db.insert(cuentasPublicitarias).values({
      idMeta: "456", programId: otroPrograma.id, nombre: "Otra cuenta", moneda: "USD",
      zonaHoraria: "America/Bogota", activo: false,
    }).returning();
    await db.insert(pautaObjetos).values({
      cuentaId: otraCuenta.id,
      programId: otroPrograma.id,
      idMeta: "ad-externo",
      nivel: "anuncio",
      padreIdMeta: "set-externo",
      nombre: "Anuncio de otro programa",
      estado: "ACTIVE",
    });
    const resumen = await sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "cron", f: fetchMeta(),
    });
    expect(resumen).toMatchObject({ estado: "ok", filas: 1, omitidas: 1 });
    const [externo] = await db.select().from(pautaObjetos)
      .where(eq(pautaObjetos.idMeta, "ad-externo"));
    expect(externo.programId).toBe(otroPrograma.id);
    expect(await db.select().from(gastoPauta).where(eq(gastoPauta.pautaObjetoId, externo.id)))
      .toHaveLength(0);
  });

  it("rechaza una segunda corrida mientras existe el candado", async () => {
    await db.insert(pautaSincronizaciones).values({
      disparadaPor: "manual", desde: "2026-10-08", hasta: "2026-10-14",
    });
    await expect(sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "cron", f: fetchMeta(),
    })).rejects.toMatchObject({ status: 409, message: "Ya hay una sincronización corriendo." });
  });

  it("deja la corrida en error sin guardar el token", async () => {
    const f = vi.fn(async () => Response.json({ error: { message: `token malo ${TOKEN}` } }, { status: 400 })) as typeof globalThis.fetch;
    const resumen = await sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "cron", f,
    });
    expect(resumen.estado).toBe("error");
    const [corrida] = await db.select().from(pautaSincronizaciones);
    expect(corrida.estado).toBe("error");
    expect(corrida.error).toContain("(oculto)");
    expect(JSON.stringify(corrida)).not.toContain(TOKEN);
  });

  it("cierra como error una corrida colgada y deja pasar la nueva", async () => {
    const viejo = new Date(Date.now() - 20 * 60_000);
    await db.insert(pautaSincronizaciones).values({
      disparadaPor: "manual", desde: "2026-10-08", hasta: "2026-10-14", inicio: viejo,
    });
    const resumen = await sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "cron", f: fetchMeta(),
    });
    expect(resumen).toMatchObject({ estado: "ok", filas: 1 });
    const colgada = await db.select().from(pautaSincronizaciones)
      .where(eq(pautaSincronizaciones.inicio, viejo));
    expect(colgada[0]).toMatchObject({ estado: "error", error: "La corrida se cortó sin terminar." });
    expect(colgada[0].fin).not.toBeNull();
    const corrientes = await db.select().from(pautaSincronizaciones)
      .where(eq(pautaSincronizaciones.estado, "ok"));
    expect(corrientes).toHaveLength(1);
  });

  it("mantiene el candado si la corrida colgada aún es reciente", async () => {
    await db.insert(pautaSincronizaciones).values({
      disparadaPor: "manual", desde: "2026-10-08", hasta: "2026-10-14",
      inicio: new Date(Date.now() - 1 * 60_000),
    });
    await expect(sincronizarPauta(db, {
      token: TOKEN, hoy: "2026-10-14", disparadaPor: "cron", f: fetchMeta(),
    })).rejects.toMatchObject({ status: 409, message: "Ya hay una sincronización corriendo." });
    expect(MINUTOS_PARA_CORRIDA_CORTADA).toBe(15);
  });

  it("corrige a cero un día que Meta deja de reportar", async () => {
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f: fetchMeta() });
    await sincronizarPauta(db, { token: TOKEN, hoy: "2026-10-14", disparadaPor: "manual", f: fetchMeta(vacios) });
    const gastos = await db.select().from(gastoPauta);
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ monto: "0.00", agendasMeta: null, programId });
  });
});
