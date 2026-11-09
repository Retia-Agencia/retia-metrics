import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/tipos";
import { esquemaRespuestaEstudiantesNuevos } from "@/lib/avisos-cs/contrato";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError(error: { status?: number; message?: string }) {
    return Response.json({ error: error.message ?? "Error interno." }, { status: error.status ?? 500 });
  },
}));

import { POST as listar } from "@/app/api/semaforo/estudiantes-nuevos/route";
import { POST as confirmar } from "@/app/api/semaforo/estudiantes-nuevos/confirmar/route";

const SECRETO = "secreto-de-prueba";
const anterior = process.env.SEMAFORO_SECRETO;
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
  process.env.SEMAFORO_SECRETO = SECRETO;
});

afterEach(() => {
  if (anterior === undefined) delete process.env.SEMAFORO_SECRETO;
  else process.env.SEMAFORO_SECRETO = anterior;
});

afterAll(async () => cerrar());

function request(path: string, body?: unknown, conSecreto = true): Request {
  return new Request(`https://crm.retia.test${path}`, {
    method: "POST",
    headers: {
      ...(conSecreto ? { "x-semaforo-secreto": SECRETO } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("endpoint de estudiantes nuevos", () => {
  it("sin secreto responde 401 vacío", async () => {
    const respuesta = await listar(request("/api/semaforo/estudiantes-nuevos", undefined, false));
    expect(respuesta.status).toBe(401);
    expect(await respuesta.text()).toBe("");
  });

  it("devuelve únicamente la lista blanca del contrato", async () => {
    const respuesta = await listar(request("/api/semaforo/estudiantes-nuevos"));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ entregas: [], sinDestinatario: 0, telefonosCs: [] });
    expect(() => esquemaRespuestaEstudiantesNuevos.parse({
      entregas: [],
      sinDestinatario: 0,
      telefonosCs: [],
      campoNoPermitido: "PII accidental",
    })).toThrow();
  });

  it("confirmar valida el cuerpo strict antes de tocar la base", async () => {
    const extra = await confirmar(request("/api/semaforo/estudiantes-nuevos/confirmar", {
      entregas: [],
      extra: true,
    }));
    expect(extra.status).toBe(400);

    const telefonoInvalido = await confirmar(request("/api/semaforo/estudiantes-nuevos/confirmar", {
      entregas: [{ avisoId: crypto.randomUUID(), telefono: "+57 300" }],
    }));
    expect(telefonoInvalido.status).toBe(400);

    const malformado = await confirmar(new Request(
      "https://crm.retia.test/api/semaforo/estudiantes-nuevos/confirmar",
      { method: "POST", headers: { "x-semaforo-secreto": SECRETO }, body: "{" },
    ));
    expect(malformado.status).toBe(400);
  });
});
