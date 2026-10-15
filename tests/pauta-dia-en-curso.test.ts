import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import {
  cuentasPublicitarias,
  fotosPauta,
  metaConexiones,
  pautaObjetos,
  pautaSincronizaciones,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  debeSincronizarDesdeElHub,
  gastoAEstaHora,
  sincronizarDiaEnCurso,
} from "@/lib/pauta/dia-en-curso";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const TOKEN = "token-dia-en-curso";
const AHORA = new Date("2026-10-14T16:00:00-05:00");

const arbol = {
  campaigns: [
    { id: "camp-1", name: "Campaña uno", effective_status: "ACTIVE", objective: "OUTCOME_LEADS" },
    { id: "camp-2", name: "Campaña dos", effective_status: "ACTIVE", objective: "OUTCOME_LEADS" },
  ],
  adsets: [
    { id: "set-1", name: "Conjunto uno", effective_status: "ACTIVE", campaign_id: "camp-1" },
    { id: "set-2", name: "Conjunto dos", effective_status: "ACTIVE", campaign_id: "camp-2" },
    { id: "set-huerfano", name: "Sin campaña", effective_status: "ACTIVE", campaign_id: "camp-ausente" },
  ],
  ads: [
    { id: "ad-1", name: "Anuncio uno", effective_status: "ACTIVE", adset_id: "set-1" },
    { id: "ad-2", name: "Anuncio dos", effective_status: "ACTIVE", adset_id: "set-1" },
    { id: "ad-3", name: "Anuncio tres", effective_status: "ACTIVE", adset_id: "set-2" },
    { id: "ad-huerfano", name: "Anuncio huérfano", effective_status: "ACTIVE", adset_id: "set-huerfano" },
  ],
};

const insights = {
  data: [
    { ad_id: "ad-1", spend: "10.25", date_start: "2026-10-14", conversions: [
      { action_type: "offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled", value: "2" },
    ] },
    { ad_id: "ad-2", spend: "2.25", date_start: "2026-10-14", conversions: [
      { action_type: "offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled", value: "1" },
    ] },
    { ad_id: "ad-3", spend: "7.00", date_start: "2026-10-14", conversions: [] },
    { ad_id: "ad-huerfano", spend: "4.00", date_start: "2026-10-14", conversions: [] },
  ],
};

function fetchMeta() {
  return vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    const borde = url.pathname.split("/").at(-1);
    if (borde === "campaigns" || borde === "adsets" || borde === "ads") {
      return Response.json({ data: arbol[borde] });
    }
    if (borde === "insights") return Response.json(insights);
    return Response.json({ error: { message: "ruta inesperada" } }, { status: 404 });
  }) as ReturnType<typeof vi.fn> & typeof globalThis.fetch;
}

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cuentaId: string;

describe("sincronizacion desde el Hub", () => {
  it("sincroniza si nunca ha corrido o la ultima corrida tiene mas de una hora", () => {
    const ahora = new Date("2026-10-14T16:00:00-05:00");

    expect(debeSincronizarDesdeElHub(null, ahora)).toBe(true);
    expect(debeSincronizarDesdeElHub(
      new Date(ahora.getTime() - 61 * 60_000),
      ahora,
    )).toBe(true);
  });

  it("no sincroniza si la ultima corrida tiene menos de una hora", () => {
    const ahora = new Date("2026-10-14T16:00:00-05:00");

    expect(debeSincronizarDesdeElHub(
      new Date(ahora.getTime() - 59 * 60_000),
      ahora,
    )).toBe(false);
  });
});

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "programa-dia-en-curso",
    nombre: "Programa día en curso",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  await db.insert(metaConexiones).values({ nombre: "Retia", tokenSecreto: TOKEN });
  const [cuenta] = await db.insert(cuentasPublicitarias).values({
    idMeta: "123",
    programId,
    nombre: "Cuenta",
    moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning();
  cuentaId = cuenta.id;
});

afterAll(async () => cerrar());

async function sembrarArbol(actualizadoEn: Date): Promise<void> {
  await db.insert(pautaObjetos).values([
    { cuentaId, programId, idMeta: "camp-1", nivel: "campana", padreIdMeta: null,
      nombre: "Campaña uno", estado: "ACTIVE", actualizadoEn },
    { cuentaId, programId, idMeta: "set-1", nivel: "conjunto", padreIdMeta: "camp-1",
      nombre: "Conjunto uno", estado: "ACTIVE", actualizadoEn },
    { cuentaId, programId, idMeta: "ad-1", nivel: "anuncio", padreIdMeta: "set-1",
      nombre: "Anuncio uno", estado: "ACTIVE", actualizadoEn },
  ]);
}

describe("fotos de pauta del día en curso", () => {
  it("dos llamadas dentro de veinte minutos hacen una sola lectura de Meta", async () => {
    const f = fetchMeta();
    const primera = await sincronizarDiaEnCurso(db, {
      token: TOKEN, ahora: AHORA, disparadaPor: "endpoint", f,
    });
    const llamadasPrimera = f.mock.calls.length;
    const segunda = await sincronizarDiaEnCurso(db, {
      token: TOKEN,
      ahora: new Date(AHORA.getTime() + 19 * 60_000),
      disparadaPor: "hub",
      f,
    });

    expect(primera.estado).toBe("ok");
    expect(segunda).toMatchObject({ estado: "reciente", ultimaFoto: AHORA });
    expect(f).toHaveBeenCalledTimes(llamadasPrimera);
  });

  it("suma los anuncios por campaña y cuenta los que no llegan a una campaña", async () => {
    const resultado = await sincronizarDiaEnCurso(db, {
      token: TOKEN, ahora: AHORA, disparadaPor: "endpoint", f: fetchMeta(),
    });
    const fotos = await db.select().from(fotosPauta).orderBy(asc(fotosPauta.gasto));

    expect(resultado).toEqual({ estado: "ok", fotos: 2, omitidas: 1 });
    expect(fotos.map(({ gasto, agendasMeta, moneda }) => ({ gasto, agendasMeta, moneda })))
      .toEqual([
        { gasto: "7.00", agendasMeta: null, moneda: "COP" },
        { gasto: "12.50", agendasMeta: 3, moneda: "COP" },
      ]);
  });

  it("borra las fotos de más de treinta días", async () => {
    await sembrarArbol(new Date(AHORA.getTime() - 23 * 60 * 60_000));
    const [campana] = await db.select().from(pautaObjetos)
      .where(eq(pautaObjetos.idMeta, "camp-1"));
    await db.insert(fotosPauta).values({
      tomadaEn: new Date(AHORA.getTime() - 31 * 24 * 60 * 60_000),
      fecha: "2026-09-13",
      programId,
      campanaId: campana.id,
      gasto: "1.00",
      moneda: "COP",
    });

    await sincronizarDiaEnCurso(db, {
      token: TOKEN, ahora: AHORA, disparadaPor: "hub", f: fetchMeta(),
    });

    expect(await db.select().from(fotosPauta)).toHaveLength(1);
  });

  it("devuelve corriendo cuando otra corrida conserva el candado", async () => {
    await db.insert(pautaSincronizaciones).values({
      disparadaPor: "endpoint", desde: "2026-10-14", hasta: "2026-10-14",
    });
    const f = fetchMeta();

    expect(await sincronizarDiaEnCurso(db, {
      token: TOKEN, ahora: AHORA, disparadaPor: "hub", f,
    })).toEqual({ estado: "corriendo" });
    expect(f).not.toHaveBeenCalled();
  });

  it("no vuelve a leer un árbol de menos de veinticuatro horas", async () => {
    await sembrarArbol(new Date(AHORA.getTime() - 23 * 60 * 60_000));
    const f = fetchMeta();

    await sincronizarDiaEnCurso(db, {
      token: TOKEN, ahora: AHORA, disparadaPor: "endpoint", f,
    });

    const bordes = f.mock.calls.map(([entrada]) => new URL(String(entrada)).pathname.split("/").at(-1));
    expect(bordes).toEqual(["insights"]);
  });

  it("vuelve a leer un árbol de más de veinticuatro horas", async () => {
    await sembrarArbol(new Date(AHORA.getTime() - 25 * 60 * 60_000));
    const f = fetchMeta();

    await sincronizarDiaEnCurso(db, {
      token: TOKEN, ahora: AHORA, disparadaPor: "endpoint", f,
    });

    const bordes = f.mock.calls.map(([entrada]) => new URL(String(entrada)).pathname.split("/").at(-1));
    expect(bordes).toEqual(expect.arrayContaining(["campaigns", "adsets", "ads", "insights"]));
  });

  it("elige la última foto sin pasarse de la hora pedida", async () => {
    await sembrarArbol(AHORA);
    const [campana] = await db.select().from(pautaObjetos)
      .where(eq(pautaObjetos.idMeta, "camp-1"));
    await db.insert(fotosPauta).values([
      { tomadaEn: new Date("2026-10-13T10:58:00-05:00"), fecha: "2026-10-13",
        programId, campanaId: campana.id, gasto: "18.00", moneda: "COP", agendasMeta: 2 },
      { tomadaEn: new Date("2026-10-13T11:05:00-05:00"), fecha: "2026-10-13",
        programId, campanaId: campana.id, gasto: "21.00", moneda: "COP", agendasMeta: 3 },
    ]);

    const foto = await gastoAEstaHora(db, {
      campanaId: campana.id, fecha: "2026-10-13", hora: "11:00",
    });
    expect(foto).toMatchObject({ gasto: "18.00", agendasMeta: 2 });
    expect(await gastoAEstaHora(db, {
      campanaId: campana.id, fecha: "2026-10-12", hora: "11:00",
    })).toBeNull();
  });
});
