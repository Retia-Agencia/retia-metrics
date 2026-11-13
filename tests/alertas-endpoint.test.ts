import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { respuestaAlertasSchema, respuestaCierreSchema } from "@/lib/alertas/contrato";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { POST as POSTAlertas } from "@/app/api/salud/alertas/route";
import { POST as POSTCierre } from "@/app/api/salud/cierre/route";

const AHORA = new Date("2026-11-13T10:00:00-05:00");
const SECRETO = "secreto-de-alertas";
const secretoAnterior = process.env.ALERTAS_SECRETO;

let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  const base = await crearBaseReutilizable();
  holder.db = base.db;
  cerrar = base.cerrar;
  vaciar = base.vaciar;
});

beforeEach(async () => {
  await vaciar();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  process.env.ALERTAS_SECRETO = SECRETO;
});

afterEach(() => {
  vi.useRealTimers();
  if (secretoAnterior === undefined) delete process.env.ALERTAS_SECRETO;
  else process.env.ALERTAS_SECRETO = secretoAnterior;
});

afterAll(async () => cerrar());

function request(secreto: string | null, ruta = "alertas"): Request {
  const headers = secreto === null ? undefined : { "x-alertas-secreto": secreto };
  return new Request(`https://crm.retia.test/api/salud/${ruta}`, { method: "POST", headers });
}

describe("endpoint de alertas tecnicas", () => {
  it.each([
    ["sin secreto", null],
    ["con secreto incorrecto", "incorrecto"],
  ])("responde 401 vacio %s", async (_caso, secreto) => {
    const respuesta = await POSTAlertas(request(secreto));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
  });

  it("responde un contrato valido con el secreto correcto", async () => {
    const respuesta = await POSTAlertas(request(SECRETO));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(respuestaAlertasSchema.parse(cuerpo)).toEqual(cuerpo);
    expect(cuerpo).toMatchObject({ generadoEn: AHORA.toISOString(), alertas: [] });
  });

  it("el contrato rechaza llaves adicionales", () => {
    expect(() => respuestaAlertasSchema.parse({
      generadoEn: AHORA.toISOString(),
      alertas: [],
      extra: true,
    })).toThrow();
  });
});

describe("endpoint de cierre diario", () => {
  it("responde 401 vacio sin el secreto correcto", async () => {
    const respuesta = await POSTCierre(request(null, "cierre"));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
  });

  it("responde un contrato valido con el secreto correcto", async () => {
    const respuesta = await POSTCierre(request(SECRETO, "cierre"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    expect(respuestaCierreSchema.parse(cuerpo)).toEqual(cuerpo);
    expect(cuerpo.generadoEn).toBe(AHORA.toISOString());
    expect(cuerpo.texto).toContain("🩺 Cierre del CRM");
  });
});
