import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  changeLog,
  cuentasPublicitarias,
  pautaObjetos,
  programs,
  reportesWhatsapp,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  codigoCortoDeCampana,
  parsearClasificacionDeCampanas,
} from "@/lib/pauta/proposito";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({ get db() { return holder.db; } }));
import { POST } from "@/app/api/semaforo/clasificar/route";

const SECRETO = "secreto-clasificar";
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  holder.db = db;
});
beforeEach(async () => {
  await vaciar();
  process.env.SEMAFORO_SECRETO = SECRETO;
});
afterAll(async () => cerrar());

async function crearCampana(slug: string, idMeta: string, destino: string | null) {
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug, nombre: slug, ticketUsd: "1000",
  }).returning();
  const [cuenta] = await db.insert(cuentasPublicitarias).values({
    idMeta: `cuenta-${slug}`, programId: programa.id, nombre: "Cuenta", moneda: "COP",
    zonaHoraria: "America/Bogota",
  }).returning();
  await db.insert(reportesWhatsapp).values({
    programId: programa.id, activo: true, destino, horas: [11], metricas: ["costo_por_agenda"],
  });
  const [campana] = await db.insert(pautaObjetos).values({
    cuentaId: cuenta.id, programId: programa.id, idMeta, nivel: "campana", padreIdMeta: null,
    nombre: `Campana ${slug}`, estado: "ACTIVE",
  }).returning();
  return campana;
}

function request(cuerpo: unknown, secreto: string | null = SECRETO) {
  return new Request("https://crm.test/api/semaforo/clasificar", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secreto ? { "x-semaforo-secreto": secreto } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
}

const entrada = (texto: string, destino: string | null = null) => ({
  texto, destino, autor: { nombre: "Alejo", telefono: "3001234567" },
});

describe("proposito de campanas desde WhatsApp", () => {
  it("parsea la marca antes o despues y varios codigos en un trozo", () => {
    expect(parsearClasificacionDeCampanas("4521 A; A #5521\nagenda 6521 7731, 8830 l")).toEqual({
      asignaciones: [
        { codigo: "4521", proposito: "agenda" },
        { codigo: "5521", proposito: "agenda" },
        { codigo: "6521", proposito: "agenda" },
        { codigo: "7731", proposito: "agenda" },
        { codigo: "8830", proposito: "lanzamiento" },
      ],
      sinProposito: [],
      ambiguos: [],
    });
    expect(codigoCortoDeCampana("1234521", ["1234521", "9934521"]).length).toBeGreaterThan(4);
  });

  it("solo acepta mensajes cuyo texto entero sea una clasificacion", () => {
    expect(parsearClasificacionDeCampanas("@159459485712556 qué pasó con el 250 a las 2?")).toBeNull();
    expect(parsearClasificacionDeCampanas("el 9375 a qué se debe?")).toBeNull();
    expect(parsearClasificacionDeCampanas("gracias")).toBeNull();
    expect(parsearClasificacionDeCampanas("9375 A, 77610516 L")).toEqual({
      asignaciones: [
        { codigo: "9375", proposito: "agenda" },
        { codigo: "77610516", proposito: "lanzamiento" },
      ],
      sinProposito: [],
      ambiguos: [],
    });
    expect(parsearClasificacionDeCampanas("#9375 agenda")).toEqual({
      asignaciones: [{ codigo: "9375", proposito: "agenda" }],
      sinProposito: [],
      ambiguos: [],
    });
  });

  it("separa trozos sin marca y con dos marcas distintas", () => {
    expect(parsearClasificacionDeCampanas("1111 2222, A 3333 L; #4444")).toEqual({
      asignaciones: [],
      sinProposito: ["1111", "2222", "4444"],
      ambiguos: [["3333"]],
    });
  });

  it("explica los trozos sin marca o con A y L a la vez", async () => {
    const respuesta = await POST(request(entrada("1111, A 2222 L")));
    expect(await respuesta.json()).toEqual({
      texto: [
        "⚠️ 1111 necesita agenda o lanzamiento",
        "⚠️ 2222: pon solo A o L",
        "Responde con el código y A (agenda) o L (lanzamiento), por ejemplo: 4521 A, 8830 L",
      ].join("\n"),
    });
  });

  it("rechaza sin secreto con 401 vacio", async () => {
    const respuesta = await POST(request(entrada("agenda 4521"), null));
    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
  });

  it("ignora un comentario sin escribir en pauta ni en la bitacora", async () => {
    const campana = await crearCampana("comentario", "12345678909375", null);
    const respuesta = await POST(request(entrada("el 9375 a qué se debe?")));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ texto: null });
    expect((await db.select().from(pautaObjetos).where(eq(pautaObjetos.id, campana.id)))[0]?.proposito)
      .toBeNull();
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("respeta el destino, registra whatsapp y no duplica un cambio real", async () => {
    const campana = await crearCampana("retia", "12345678904521", null);
    await crearCampana("otro-grupo", "99999999994521", "120363000000000001@g.us");
    const primera = await POST(request(entrada("04521 A")));
    expect(primera.status).toBe(200);
    expect(await primera.json()).toEqual({
      texto: "✅ Campana retia → Agenda. Cuenta desde el próximo semáforo.",
    });
    expect((await db.select().from(pautaObjetos).where(eq(pautaObjetos.id, campana.id)))[0]?.proposito)
      .toBe("agenda");
    const rastros = await db.select().from(changeLog).where(eq(changeLog.registroId, campana.id));
    expect(rastros).toMatchObject([{
      tabla: "pauta_objetos", campo: "proposito", valorAnterior: null, valorNuevo: "agenda",
      origen: "whatsapp", userId: null, etiqueta: "Campana retia · Alejo por WhatsApp",
    }]);
    await POST(request(entrada("04521 A")));
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, campana.id))).toHaveLength(1);
  });

  it("extiende codigos iguales entre programas y clasifica ambos sin ambiguedad", async () => {
    const primera = await crearCampana("uno", "12345678904521", null);
    const segunda = await crearCampana("dos", "99999999994521", null);
    const respuesta = await POST(request(entrada("04521 A, 94521 L")));
    expect(await respuesta.json()).toEqual({
      texto: "✅ Campana uno → Agenda · Campana dos → Lanzamiento. Cuenta desde el próximo semáforo.",
    });
    expect((await db.select().from(pautaObjetos).where(eq(pautaObjetos.id, primera.id)))[0]?.proposito)
      .toBe("agenda");
    expect((await db.select().from(pautaObjetos).where(eq(pautaObjetos.id, segunda.id)))[0]?.proposito)
      .toBe("lanzamiento");
  });
});
