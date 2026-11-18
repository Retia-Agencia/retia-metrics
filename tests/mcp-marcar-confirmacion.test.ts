import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { crearConRastro } from "@/lib/crm/rastro";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let closerId: string;
let gerenteId: string;
let tokenCloser: string;
let tokenGerente: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});

afterAll(async () => {
  estado.db = null;
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "mcp-confirmacion",
    nombre: "MCP confirmación",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const [closer, gerente] = await db.insert(users).values([
    { email: "closer-mcp-confirmacion@retia.test", nombre: "Closer", rol: "closer" },
    { email: "gerente-mcp-confirmacion@retia.test", nombre: "Gerente", rol: "gerente", operaComoCloser: true },
  ]).returning();
  closerId = closer.id;
  gerenteId = gerente.id;
  await db.insert(miembrosPrograma).values({ userId: closerId, programId });
  const [closerToken, gerenteToken] = await Promise.all([
    emitirTokenPersonal(db, { userId: closerId, actorId: closerId, nombre: "Closer", scope: "escritura" }),
    emitirTokenPersonal(db, { userId: gerenteId, actorId: gerenteId, nombre: "Gerente", scope: "escritura" }),
  ]);
  tokenCloser = closerToken.valor;
  tokenGerente = gerenteToken.valor;
});

function request(metodo: string, params: Record<string, unknown>, token: string) {
  return new Request("https://crm.retia.test/api/mcp", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: metodo, params }),
  });
}

async function post(metodo: string, params: Record<string, unknown>, token: string) {
  const { POST } = await import("@/app/api/mcp/route");
  const respuesta = await POST(request(metodo, params, token));
  const bruto = await respuesta.text();
  const linea = bruto.startsWith("event:")
    ? bruto.split("\n").find((parte) => parte.startsWith("data: "))?.slice(6) ?? "{}"
    : bruto;
  return JSON.parse(linea) as Record<string, unknown>;
}

function contenido(respuesta: Record<string, unknown>) {
  return (respuesta.result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent;
}

async function caso() {
  const [lead] = await db.insert(leads).values({
    programId,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `${crypto.randomUUID()}@retia.test`,
    nombre: "Lead confirmado",
  }).returning();
  const [deal] = await db.insert(deals).values({
    programId,
    leadId: lead.id,
    ownerUserId: closerId,
    etapa: "agendado",
  }).returning();
  const callId = await crearConRastro({
    db,
    tabla: calls,
    nombreTabla: "calls",
    actorId: closerId,
    etiqueta: lead.emailNormalizado,
  }, {
    programId,
    dealId: deal.id,
    closerUserId: closerId,
    fechaAgenda: new Date("2026-11-20T09:00:00-05:00"),
    resultado: "agendada",
    origen: "crm",
  });
  const [call] = await db.select().from(calls).where(eq(calls.id, callId));
  return { deal, call };
}

async function preparar(dealId: string, callId: string, token: string) {
  return post("tools/call", {
    name: "preparar_accion",
    arguments: {
      programa: "mcp-confirmacion",
      accion: "marcar_confirmacion",
      argumentos: { deal_id: dealId, llamada_id: callId, confirmacion: "confirmada" },
    },
  }, token);
}

async function confirmar(id: string, token: string) {
  return post("tools/call", { name: "confirmar_cambio", arguments: { id } }, token);
}

describe("acción MCP marcar_confirmacion", () => {
  it.each(["closer", "gerente"] as const)("%s prepara, confirma una vez y ve la vista previa", async (rol) => {
    const { deal, call } = await caso();
    const token = rol === "closer" ? tokenCloser : tokenGerente;
    const previa = contenido(await preparar(deal.id, call.id, token))!;
    expect(previa.filas).toEqual([expect.objectContaining({
      antes: { confirmacion: null },
      despues: { confirmacion: "confirmada" },
      se_puede_aplicar: true,
      detalle: { cita_en: "2026-11-20T14:00:00.000Z", lead: "Lead confirmado" },
    })]);

    const primera = contenido(await confirmar(previa.id as string, token))!;
    const segunda = contenido(await confirmar(previa.id as string, token))!;
    expect(segunda).toEqual(primera);
    expect(primera.filas).toEqual([expect.objectContaining({ estado: "aplicada", evento_id: expect.any(String) })]);
    expect((await db.select({ confirmacion: calls.confirmacion }).from(calls).where(eq(calls.id, call.id)))[0].confirmacion)
      .toBe("confirmada");
    expect(await db.select().from(changeLog).where(and(
      eq(changeLog.registroId, call.id),
      eq(changeLog.campo, "confirmacion"),
    ))).toHaveLength(1);

    const eventoId = (primera.filas as { evento_id: string }[])[0].evento_id;
    const deshacer = contenido(await post("tools/call", {
      name: "preparar_accion",
      arguments: {
        programa: "mcp-confirmacion",
        accion: "deshacer_evento",
        argumentos: { deal_id: deal.id, evento_id: eventoId },
      },
    }, token))!;
    expect(contenido(await confirmar(deshacer.id as string, token))!.filas)
      .toEqual([expect.objectContaining({ estado: "aplicada" })]);
    expect((await db.select({ confirmacion: calls.confirmacion }).from(calls).where(eq(calls.id, call.id)))[0].confirmacion)
      .toBeNull();
  });
});
