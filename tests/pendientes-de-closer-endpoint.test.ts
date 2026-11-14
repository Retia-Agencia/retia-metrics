import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  avisosPendientesCloserEnvios,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  miembrosPrograma,
  programs,
  sources,
  submissions,
  users,
  usuariosWhatsapp,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esquemaRespuestaAvisosPendientes } from "@/lib/pendientes-de-closer/contrato";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({ get db() { return holder.db; } }));
vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError(error: { status?: number; message?: string }) {
    return Response.json({ error: error.message ?? "Error interno." }, { status: error.status ?? 500 });
  },
}));

import { POST as listar } from "@/app/api/pendientes/avisos/route";
import { POST as confirmar } from "@/app/api/pendientes/avisos/confirmar/route";

const SECRETO = "secreto-428";
const anterior = process.env.SEMAFORO_SECRETO;
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let cohortId: string;
let closer: string;
let otro: string;
let telefono: string;
let secuencia = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  holder.db = db;
  process.env.SEMAFORO_SECRETO = SECRETO;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-13T13:30:00Z")); // viernes, 8:30 a.m. en Bogotá
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, nombre: "Tactical", slug: "tactical", ticketUsd: "1500" }).returning();
  programId = programa.id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  cohortId = (await db.insert(cohorts).values({
    programId,
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "1500",
    fechaInicioClases: "2026-12-01",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-11-30",
    estado: "activo",
  }).returning())[0].id;
  const cuentas = await db.insert(users).values([
    { email: "andrea@retia.test", nombre: "Andrea Pérez", rol: "closer", closerId: "Andrea" },
    { email: "maru@retia.test", nombre: "Maru Gómez", rol: "closer", closerId: "Maru" },
  ]).returning();
  closer = cuentas[0].id;
  otro = cuentas[1].id;
  await db.insert(miembrosPrograma).values(cuentas.map((u) => ({ userId: u.id, programId })));
  telefono = "573001112233";
  await db.insert(usuariosWhatsapp).values({ userId: closer, telefono });
});

afterEach(() => {
  holder.db = null;
  vi.useRealTimers();
  if (anterior === undefined) delete process.env.SEMAFORO_SECRETO;
  else process.env.SEMAFORO_SECRETO = anterior;
});

afterAll(async () => cerrar());

async function dealNuevo(owner: string, nombre: string): Promise<string> {
  const [lead] = await db.insert(leads).values({
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    programId,
    emailNormalizado: `lead-${++secuencia}@retia.test`,
    nombre,
    numAplicaciones: 1,
  }).returning();
  const [envio] = await db.insert(submissions).values({
    leadId: lead.id,
    sourceId,
    token: `token-${secuencia}`,
    utmSource: "meta",
    utmMedium: "cpc",
  }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    submissionOrigenId: envio.id,
    programId,
    cohortId,
    etapa: "registrado",
    ownerUserId: owner,
    ownerNovedadEn: new Date(),
  }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: null, a: "registrado", fecha: new Date() });
  return deal.id;
}

function request(path: string, body: unknown, conSecreto = true): Request {
  return new Request(`https://crm.retia.test${path}`, {
    method: "POST",
    headers: {
      ...(conSecreto ? { "x-semaforo-secreto": SECRETO } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("avisos de registros pendientes", () => {
  it("exige secreto y el contrato de salida es strict", async () => {
    const sinSecreto = await listar(request("/api/pendientes/avisos", { ventana: "manana" }, false));
    expect(sinSecreto.status).toBe(401);
    expect(await sinSecreto.text()).toBe("");

    const extra = await listar(request("/api/pendientes/avisos", { ventana: "manana", extra: true }));
    expect(extra.status).toBe(400);
    expect(() => esquemaRespuestaAvisosPendientes.parse({ avisos: [], sinDestinatario: [], extra: true })).toThrow();
  });

  it("proyecta cada dueño y reporta al closer pendiente sin WhatsApp", async () => {
    await dealNuevo(closer, "Camilo Moreno");
    await dealNuevo(otro, "Nombre Ajeno");
    const response = await listar(request("/api/pendientes/avisos", { ventana: "manana" }));
    expect(response.status).toBe(200);
    const cuerpo = esquemaRespuestaAvisosPendientes.parse(await response.json());
    expect(cuerpo.avisos).toHaveLength(1);
    expect(cuerpo.avisos[0]).toMatchObject({ userId: closer, telefono, ventana: "manana", dia: "2026-11-13" });
    expect(cuerpo.avisos[0].texto).toContain("Camilo Moreno · Tactical · Registrado");
    expect(cuerpo.avisos[0].texto).not.toContain("Nombre Ajeno");
    expect(cuerpo.sinDestinatario).toEqual([otro]);
  });

  it("solo confirma pares elegibles y no repite la ventana del día", async () => {
    await dealNuevo(closer, "Camilo Moreno");
    await dealNuevo(otro, "Nombre Ajeno");
    const forjada = await confirmar(request("/api/pendientes/avisos/confirmar", {
      avisos: [{ userId: otro, ventana: "manana", telefono }],
    }));
    expect(await forjada.json()).toEqual({ confirmados: 0 });
    expect(await db.select().from(avisosPendientesCloserEnvios)).toHaveLength(0);

    const valida = await confirmar(request("/api/pendientes/avisos/confirmar", {
      avisos: [{ userId: closer, ventana: "manana", telefono }],
    }));
    expect(await valida.json()).toEqual({ confirmados: 1 });
    const segunda = esquemaRespuestaAvisosPendientes.parse(await (await listar(
      request("/api/pendientes/avisos", { ventana: "manana" }),
    )).json());
    expect(segunda.avisos).toEqual([]);
  });

  it("en sábado devuelve vacío aunque haya pendientes", async () => {
    vi.setSystemTime(new Date("2026-11-14T13:30:00Z"));
    await dealNuevo(closer, "Camilo Moreno");
    const response = await listar(request("/api/pendientes/avisos", { ventana: "manana" }));
    expect(await response.json()).toEqual({ avisos: [], sinDestinatario: [] });
  });
});
