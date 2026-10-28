import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cuentasPublicitarias,
  pautaObjetos,
  pautaSincronizaciones,
  programs,
  reportesWhatsapp,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import * as agenda from "@/lib/queries/hechos/agenda";
import { esquemaRespuestaSemaforo } from "@/lib/reporte-whatsapp/contrato";
import * as semaforo from "@/lib/semaforo/semaforo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { POST } from "@/app/api/semaforo/envios/route";

const AHORA = new Date("2026-10-13T11:00:00-05:00");
const SECRETO = "secreto-del-semaforo";
const secretoAnterior = process.env.SEMAFORO_SECRETO;
const fetchAnterior = globalThis.fetch;

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  holder.db = db;
});

beforeEach(async () => {
  await vaciar();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  process.env.SEMAFORO_SECRETO = SECRETO;
  globalThis.fetch = vi.fn(async (entrada: string | URL | Request) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    const cuenta = /\/act_([^/]+)\/insights$/.exec(url.pathname)?.[1];
    if (/\/act_[^/]+$/.test(url.pathname)) {
      return Response.json({ account_status: 1, disable_reason: 0, amount_spent: "10000", spend_cap: "0" });
    }
    return Response.json({
      data: cuenta ? [{
        ad_id: `ad-${cuenta}`,
        spend: "10000",
        date_start: "2026-10-13",
        conversions: [],
      }] : [],
    });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  globalThis.fetch = fetchAnterior;
  if (secretoAnterior === undefined) delete process.env.SEMAFORO_SECRETO;
  else process.env.SEMAFORO_SECRETO = secretoAnterior;
});

afterAll(async () => cerrar());

async function crearPrograma(
  slug: string,
  opciones: {
    activo?: boolean;
    hora?: number;
    metricas?: [] | ["costo_por_agenda"];
    destino?: string | null;
  } = {},
) {
  const activo = opciones.activo ?? true;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    activo,
    slug,
    nombre: `Programa ${slug}`,
    ticketUsd: "1000",
  }).returning();
  await sembrarIntegracion(db, programa.id, "meta", { token: "token-meta" }, { nombre: "Retia" });
  await db.insert(reportesWhatsapp).values({
    programId: programa.id,
    activo: true,
    destino: opciones.destino ?? null,
    horas: [opciones.hora ?? 11],
    horaCierre: 18,
    metricas: opciones.metricas ?? ["costo_por_agenda"],
  });
  if (activo) {
    const idMeta = `cuenta-${slug}`;
    const [cuenta] = await db.insert(cuentasPublicitarias).values({
      idMeta,
      programId: programa.id,
      nombre: `Cuenta ${slug}`,
      moneda: "COP",
      zonaHoraria: "America/Bogota",
    }).returning();
    await db.insert(pautaObjetos).values([
      {
        cuentaId: cuenta.id, programId: programa.id, idMeta: `campana-${slug}`,
        nivel: "campana", padreIdMeta: null, nombre: "Campana", estado: "ACTIVE",
        actualizadoEn: AHORA,
      },
      {
        cuentaId: cuenta.id, programId: programa.id, idMeta: `conjunto-${slug}`,
        nivel: "conjunto", padreIdMeta: `campana-${slug}`, nombre: "Conjunto", estado: "ACTIVE",
        actualizadoEn: AHORA,
      },
      {
        cuentaId: cuenta.id, programId: programa.id, idMeta: `ad-${idMeta}`,
        nivel: "anuncio", padreIdMeta: `conjunto-${slug}`, nombre: "Anuncio", estado: "ACTIVE",
        actualizadoEn: AHORA,
      },
    ]);
  }
  return programa;
}

function request(secreto: string | null = SECRETO): Request {
  const headers = secreto === null ? undefined : { "x-semaforo-secreto": secreto };
  return new Request("https://crm.retia.test/api/semaforo/envios", { method: "POST", headers });
}

async function cuerpo() {
  const respuesta = await POST(request());
  expect(respuesta.status).toBe(200);
  return respuesta.json() as Promise<Record<string, unknown>>;
}

describe("endpoint de maquina del semaforo", () => {
  it("sin secreto responde 401 vacio sin tocar la base ni Meta", async () => {
    const respuesta = await POST(request(null));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
    expect(await db.select().from(pautaSincronizaciones)).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("con secreto incorrecto responde 401", async () => {
    const respuesta = await POST(request("incorrecto"));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("sin secreto configurado responde 401 antes de leer la base", async () => {
    delete process.env.SEMAFORO_SECRETO;
    holder.db = null;

    const respuesta = await POST(request());

    holder.db = db;
    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("a las once devuelve el envio de dia con su metrica", async () => {
    await crearPrograma("uno");

    const respuesta = await cuerpo();

    expect(respuesta).toMatchObject({
      generadoEn: "2026-10-13T11:00:00-05:00",
      sincronizacion: { estado: "ok", ultimaFoto: "2026-10-13T11:00:00-05:00" },
      envios: [{
        tipo: "semaforo",
        hora: "11:00",
        destino: null,
        bloques: [{
          programa: "Programa uno",
          tipo: "dia",
          enlaceHub: "https://crm.retia.test/p/uno/hub?seccion=pauta",
          metricas: [{ metrica: "costo_por_agenda" }],
          trazaRota: [],
          error: null,
        }],
      }],
    });
    const [envio] = respuesta.envios as Array<{
      texto: string;
      bloques: Array<{ enlaceHub: string }>;
    }>;
    expect(envio.texto).toMatch(/^🚦/);
    expect(envio.texto).toContain("CRM: https://crm.retia.test");
    expect(envio.texto).toMatch(/CRM = citas con UTM de pauta\.$/);
    expect(respuesta.envios).toHaveLength(1);
  });

  it("a la hora de cierre agrega las horas de agenda despues del semaforo", async () => {
    vi.setSystemTime(new Date("2026-10-13T18:00:00-05:00"));
    await crearPrograma("cierre");

    const respuesta = await cuerpo();
    const envios = respuesta.envios as Array<{
      tipo: string;
      destino: string | null;
      texto: string;
      bloques: unknown[];
    }>;

    expect(envios.map((envio) => envio.tipo)).toEqual(["semaforo", "horas_agenda"]);
    expect(envios[0]).toMatchObject({ destino: null });
    expect(envios[1]).toMatchObject({ destino: null, bloques: [] });
    expect(envios[1].texto).toContain("🕒 Horas de agenda · lunes 12-oct");
    expect(envios[1].texto).toContain("*Programa cierre* · sin agendas");
  });

  it("a una hora sin envios no sincroniza ni llama a Meta", async () => {
    vi.setSystemTime(new Date("2026-10-13T12:00:00-05:00"));
    await crearPrograma("uno");

    const respuesta = await cuerpo();

    expect(respuesta).toMatchObject({ envios: [], sincronizacion: null });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("omite programas y metricas apagados", async () => {
    await crearPrograma("apagado", { activo: false });
    await crearPrograma("sin-metrica", { metricas: [] });

    const respuesta = await cuerpo();

    expect(respuesta).toMatchObject({ envios: [], sincronizacion: null });
  });

  it("dos programas a la misma hora salen en un solo envio con los dos bloques", async () => {
    await crearPrograma("uno");
    await crearPrograma("dos");

    const respuesta = await cuerpo();
    const [envio] = respuesta.envios as Array<{
      texto: string;
      bloques: Array<{ programa: string }>;
    }>;

    expect(respuesta.envios).toHaveLength(1);
    expect(envio.bloques.map((bloque) => bloque.programa))
      .toEqual(["Programa dos", "Programa uno"]);
    expect(envio.texto.match(/🚦 Semáforo de pauta · 11:00/g)).toHaveLength(1);
    expect(envio.texto).toContain("*Programa dos*\n");
    expect(envio.texto).toContain("*Programa uno*\n");
    expect(envio.texto.match(/━━━━━━━━━━/g)).toHaveLength(1);
  });

  it("en el cierre cada destino recibe sus propios programas en ambos envios", async () => {
    vi.setSystemTime(new Date("2026-10-13T18:00:00-05:00"));
    await crearPrograma("predeterminado");
    await crearPrograma("grupo", { destino: "120363000000000001@g.us" });

    const respuesta = await cuerpo();
    const envios = respuesta.envios as Array<{
      tipo: string;
      destino: string | null;
      texto: string;
      bloques: Array<{ programa: string }>;
    }>;

    expect(envios.map(({ destino, tipo }) => [destino, tipo])).toEqual([
      [null, "semaforo"],
      [null, "horas_agenda"],
      ["120363000000000001@g.us", "semaforo"],
      ["120363000000000001@g.us", "horas_agenda"],
    ]);
    expect(envios[1].texto).toContain("*Programa predeterminado* · sin agendas");
    expect(envios[1].texto).not.toContain("Programa grupo");
    expect(envios[3].texto).toContain("*Programa grupo* · sin agendas");
    expect(envios[3].texto).not.toContain("Programa predeterminado");
  });

  it("si fallan las horas de un programa conserva el semaforo y los demas programas", async () => {
    vi.setSystemTime(new Date("2026-10-13T18:00:00-05:00"));
    await crearPrograma("roto");
    await crearPrograma("sano");
    vi.spyOn(agenda, "listar").mockRejectedValueOnce(new Error("fallo de prueba"));

    const respuesta = await cuerpo();
    const envios = respuesta.envios as Array<{ tipo: string; texto: string }>;

    expect(envios.map((envio) => envio.tipo)).toEqual(["semaforo", "horas_agenda"]);
    expect(envios[0].texto).toContain("*Programa roto*");
    expect(envios[0].texto).toContain("*Programa sano*");
    expect(envios[1].texto).toContain("*Programa roto* · no se pudieron leer las agendas");
    expect(envios[1].texto).toContain("*Programa sano* · sin agendas");
  });

  it("separa, ordena y declara los envíos por destino", async () => {
    await crearPrograma("predeterminado");
    await crearPrograma("grupo-dos", { destino: "120363000000000002@g.us" });
    await crearPrograma("grupo-uno", { destino: "120363000000000001@g.us" });

    const respuesta = await cuerpo();
    const envios = respuesta.envios as Array<{
      destino: string | null;
      texto: string;
      bloques: Array<{ programa: string }>;
    }>;

    expect(envios.map((envio) => envio.destino)).toEqual([
      null,
      "120363000000000001@g.us",
      "120363000000000002@g.us",
    ]);
    expect(envios.map((envio) => envio.bloques.map((bloque) => bloque.programa))).toEqual([
      ["Programa predeterminado"],
      ["Programa grupo-uno"],
      ["Programa grupo-dos"],
    ]);
    expect(envios.every((envio) => envio.texto.match(/🚦 Semáforo de pauta · 11:00/g)?.length === 1))
      .toBe(true);
    expect(respuesta.configuracion).toEqual(expect.arrayContaining([
      expect.objectContaining({
        programa: "Programa predeterminado",
        destino: null,
      }),
      expect.objectContaining({
        programa: "Programa grupo-uno",
        destino: "120363000000000001@g.us",
      }),
    ]));
  });

  it("dos llamadas seguidas leen Meta una sola vez", async () => {
    await crearPrograma("uno");

    const primera = await cuerpo();
    const llamadas = vi.mocked(globalThis.fetch).mock.calls.length;
    const segunda = await cuerpo();

    expect(llamadas).toBeGreaterThan(0);
    expect(globalThis.fetch).toHaveBeenCalledTimes(llamadas + 1);
    expect(primera.sincronizacion).toMatchObject({ estado: "ok" });
    expect(segunda.sincronizacion).toMatchObject({ estado: "reciente" });
  });

  it("incluye en el bloque las cuentas de Meta de su programa", async () => {
    await crearPrograma("cuentas");

    const respuesta = await cuerpo();
    const [envio] = respuesta.envios as Array<{
      bloques: Array<{ cuentasMeta: unknown[] }>;
    }>;

    expect(envio.bloques[0]?.cuentasMeta).toEqual([
      { nombre: "Cuenta cuentas", estado: "al_dia", detalle: null },
    ]);
  });

  it("si falla el semaforo de un programa conserva su bloque y el del otro", async () => {
    const roto = await crearPrograma("roto");
    await crearPrograma("sano");
    const original = semaforo.semaforoDelPrograma;
    vi.spyOn(semaforo, "semaforoDelPrograma").mockImplementation((base, args) => {
      if (args.programId === roto.id) return Promise.reject(new Error("fallo de prueba"));
      return original(base, args);
    });

    const respuesta = await cuerpo();
    const [envio] = respuesta.envios as Array<{
      texto: string;
      bloques: Array<{ programa: string; metricas: unknown[]; error: string | null }>;
    }>;

    expect(respuesta.envios).toHaveLength(1);
    expect(envio.bloques.find((bloque) => bloque.programa === "Programa roto")).toMatchObject({
      metricas: [],
      error: "No se pudo calcular el semáforo de este programa.",
    });
    expect(envio.bloques.find((bloque) => bloque.programa === "Programa sano")).toMatchObject({
      metricas: [{ metrica: "costo_por_agenda" }],
      error: null,
    });
    expect(envio.texto).toContain("*Programa roto*\n⚠️");
    expect(envio.texto).toContain("⚠️ No se pudo calcular el semáforo de este programa.");
    expect(envio.texto).toContain("*Programa sano*\n");
    expect(envio.texto).toContain("Costo por agenda");
  });
});

const LLAVES_PERMITIDAS = new Set([
  "generadoEn", "sincronizacion", "estado", "ultimaFoto", "envios", "configuracion",
  "bloques", "programa", "tipo", "hora", "enlaceHub", "metricas", "cuentasMeta", "detalle", "error", "horas",
  "horaCierre", "metrica", "color", "motivo", "moneda", "gasto", "agendasCrm", "costo",
  "umbral", "meta", "aceptable", "porcentajeDelUmbral", "comparacion", "dia", "etiqueta",
  "trayectoria", "racha", "dias", "agendasMeta", "campanas", "nombre", "notas", "texto", "destino",
  "codigo", "proposito", "lanzamiento", "gastoTotal", "registrosMeta", "costoPorRegistro",
  "trazaRota", "fuente", "pagos", "pagosSinId", "pagosSinFbclid", "sinId", "fbclidRoto",
]);

function exigirListaBlanca(valor: unknown): void {
  if (Array.isArray(valor)) {
    valor.forEach(exigirListaBlanca);
    return;
  }
  if (!valor || typeof valor !== "object") return;
  for (const [llave, hijo] of Object.entries(valor)) {
    if (!LLAVES_PERMITIDAS.has(llave)) throw new Error(`Llave no permitida: ${llave}`);
    exigirListaBlanca(hijo);
  }
}

describe("lista blanca del contrato", () => {
  it("la respuesta real solo contiene llaves permitidas", async () => {
    vi.setSystemTime(new Date("2026-10-13T18:00:00-05:00"));
    await crearPrograma("contrato");
    const respuesta = await cuerpo();

    expect(() => exigirListaBlanca(respuesta)).not.toThrow();
    expect(esquemaRespuestaSemaforo.safeParse(respuesta).success).toBe(true);
  });

  it("rechaza recursivamente una llave extra", async () => {
    await crearPrograma("contrato");
    const respuesta = await cuerpo();
    const adulterada = {
      ...respuesta,
      envios: [{ ...(respuesta.envios as object[])[0], persona: "no debe salir" }],
    };

    expect(() => exigirListaBlanca(adulterada)).toThrow("Llave no permitida: persona");
    expect(esquemaRespuestaSemaforo.safeParse(adulterada).success).toBe(false);
  });

  it("rechaza destino dentro de un bloque aunque sea válido en un envío", async () => {
    await crearPrograma("contrato");
    const respuesta = await cuerpo();
    const [envio] = respuesta.envios as Array<{ bloques: object[] }>;
    const adulterada = {
      ...respuesta,
      envios: [{
        ...(respuesta.envios as object[])[0],
        bloques: [{ ...envio.bloques[0], destino: "grupo@g.us" }],
      }],
    };

    expect(() => exigirListaBlanca(adulterada)).not.toThrow();
    expect(esquemaRespuestaSemaforo.safeParse(adulterada).success).toBe(false);
  });
});
