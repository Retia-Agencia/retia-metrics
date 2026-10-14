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

function fetchMeta(datosInsights: unknown = insights) {
  return vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    expect(url.toString()).not.toContain(TOKEN);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    const borde = url.pathname.split("/").at(-1);
    if (borde === "campaigns" || borde === "adsets" || borde === "ads") {
      return Response.json({ data: arbol[borde] });
    }
    if (borde === "insights") return Response.json(datosInsights);
    return Response.json({ error: { message: "ruta inesperada" } }, { status: 404 });
  }) as typeof globalThis.fetch;
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
