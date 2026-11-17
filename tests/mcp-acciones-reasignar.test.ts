import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let gerenteId: string;
let developerId: string;
let closerId: string;
let nuevoDuenoId: string;
let duenoAjenoId: string;
let tokenGerente: string;
let tokenDeveloper: string;
let tokenCloser: string;
let tokenPaid: string;

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
  const [programa, otroPrograma] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "reasignar-a", nombre: "Reasignar A", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "reasignar-b", nombre: "Reasignar B", ticketUsd: "1500" },
  ]).returning();
  programId = programa.id;
  otroProgramId = otroPrograma.id;
  const [gerente, developer, closer, nuevoDueno, duenoAjeno, paid] = await db.insert(users).values([
    { email: "gerente-reasignar@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "developer-reasignar@retia.test", nombre: "Developer", rol: "developer" },
    { email: "closer-reasignar@retia.test", nombre: "Closer anterior", rol: "closer", closerId: "closer-reasignar" },
    { email: "nuevo-reasignar@retia.test", nombre: "Closer nuevo", rol: "closer", closerId: "nuevo-reasignar" },
    { email: "ajeno-reasignar@retia.test", nombre: "Closer ajeno", rol: "closer", closerId: "ajeno-reasignar" },
    { email: "paid-reasignar@retia.test", nombre: "Paid", rol: "paid_trafficker" },
  ]).returning();
  gerenteId = gerente.id;
  developerId = developer.id;
  closerId = closer.id;
  nuevoDuenoId = nuevoDueno.id;
  duenoAjenoId = duenoAjeno.id;
  await db.insert(miembrosPrograma).values([
    { userId: closerId, programId },
    { userId: nuevoDuenoId, programId },
    { userId: duenoAjenoId, programId: otroProgramId },
    { userId: paid.id, programId },
  ]);
  const [gerenteToken, developerToken, closerToken, paidToken] = await Promise.all([
    emitirTokenPersonal(db, { userId: gerenteId, actorId: gerenteId, nombre: "Gerente", scope: "escritura" }),
    emitirTokenPersonal(db, { userId: developerId, actorId: developerId, nombre: "Developer", scope: "escritura" }),
    emitirTokenPersonal(db, { userId: closerId, actorId: closerId, nombre: "Closer", scope: "escritura" }),
    emitirTokenPersonal(db, { userId: paid.id, actorId: paid.id, nombre: "Paid", scope: "escritura" }),
  ]);
  tokenGerente = gerenteToken.valor;
  tokenDeveloper = developerToken.valor;
  tokenCloser = closerToken.valor;
  tokenPaid = paidToken.valor;
});

async function nuevoDeal(programa = programId, ownerUserId = closerId, anulado = false) {
  const [lead] = await db.insert(leads).values({
    programId: programa,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `${crypto.randomUUID()}@retia.test`,
    nombre: "Lead de reasignación",
  }).returning();
  return (await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    ownerUserId,
    etapa: "agendado",
    ...(anulado ? { anuladoEn: new Date("2026-11-17T10:00:00-05:00"), anuladoPor: gerenteId, motivoAnulacion: "Duplicado" } : {}),
  }).returning())[0];
}

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

function texto(respuesta: Record<string, unknown>) {
  return ((respuesta.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text) ?? JSON.stringify(respuesta);
}

async function preparar(dealId: string, duenoId: string, token = tokenGerente, programa = "reasignar-a") {
  return post("tools/call", {
    name: "preparar_accion",
    arguments: {
      programa,
      accion: "reasignar_deal",
      argumentos: { deal_id: dealId, id_del_usuario: duenoId },
    },
  }, token);
}

async function confirmar(id: string, token = tokenGerente) {
  return post("tools/call", { name: "confirmar_cambio", arguments: { id } }, token);
}

describe("acción MCP reasignar_deal", () => {
  it.each(["gerente", "developer"] as const)("%s la descubre, prepara y confirma", async (rol) => {
    const deal = await nuevoDeal();
    const token = rol === "gerente" ? tokenGerente : tokenDeveloper;
    const capacidades = contenido(await post("tools/call", { name: "capacidades", arguments: {} }, token))!;
    expect((capacidades.acciones as { clave: string }[]).map((accion) => accion.clave)).toContain("reasignar_deal");
    const previa = contenido(await preparar(deal.id, nuevoDuenoId, token))!;
    expect(previa.filas).toEqual([expect.objectContaining({ se_puede_aplicar: true })]);
    const confirmada = contenido(await confirmar(previa.id as string, token))!;
    expect(confirmada.filas).toEqual([expect.objectContaining({ estado: "aplicada", evento_id: expect.any(String) })]);
    expect((await db.select({ owner: deals.ownerUserId }).from(deals).where(eq(deals.id, deal.id)))[0].owner).toBe(nuevoDuenoId);
  });

  it.each(["closer", "paid trafficker"] as const)("%s no la descubre y una preparación forjada se rechaza", async (rol) => {
    const token = rol === "closer" ? tokenCloser : tokenPaid;
    const capacidades = contenido(await post("tools/call", { name: "capacidades", arguments: {} }, token))!;
    expect((capacidades.acciones as { clave: string }[]).map((accion) => accion.clave)).not.toContain("reasignar_deal");
    expect(texto(await preparar((await nuevoDeal()).id, nuevoDuenoId, token))).toContain("No puedes usar esa acción");
  });

  it("rechaza dueño imposible, deal anulado y oculta un deal de otro programa", async () => {
    const normal = await nuevoDeal();
    const duenoImposible = contenido(await preparar(normal.id, duenoAjenoId))!;
    expect(duenoImposible.filas).toEqual([expect.objectContaining({
      se_puede_aplicar: false,
      razon: "El dueño tiene que ser un closer activo con membresía en el programa del deal.",
    })]);

    const anulado = await nuevoDeal(programId, closerId, true);
    expect((contenido(await preparar(anulado.id, nuevoDuenoId))!.filas as { razon: string }[])[0].razon)
      .toBe("El deal está anulado: no se edita.");

    const ajeno = await nuevoDeal(otroProgramId, duenoAjenoId);
    expect(contenido(await preparar(ajeno.id, nuevoDuenoId))!.filas).toEqual([
      expect.objectContaining({ antes: null, despues: null, se_puede_aplicar: false, razon: "No existe ese deal" }),
    ]);
  });

  it("muestra dueños, etapa y llamada pendiente; confirma una vez y permite deshacer", async () => {
    const deal = await nuevoDeal();
    const llamada = (await db.insert(calls).values({
      programId,
      dealId: deal.id,
      closerUserId: closerId,
      resultado: "agendada",
      fechaAgenda: new Date("2026-11-20T09:00:00-05:00"),
      origen: "crm",
    }).returning())[0];
    const previa = contenido(await preparar(deal.id, nuevoDuenoId))!;
    expect(previa.filas).toEqual([expect.objectContaining({
      antes: { dueno: { id: closerId, nombre: "Closer anterior" }, etapa: "agendado" },
      despues: { dueno: { id: nuevoDuenoId, nombre: "Closer nuevo" }, etapa: "agendado" },
      detalle: {
        llamada_pendiente: {
          id: llamada.id,
          cita_en: "2026-11-20T14:00:00.000Z",
          closer_actual: "Closer anterior",
        },
        aviso: expect.stringContaining("queda a nombre del closer anterior"),
      },
      efecto_externo: false,
    })]);

    const primera = contenido(await confirmar(previa.id as string))!;
    const segunda = contenido(await confirmar(previa.id as string))!;
    expect(segunda).toEqual(primera);
    const eventoId = (primera.filas as { evento_id: string }[])[0].evento_id;
    const cambios = await db.select().from(changeLog).where(and(
      eq(changeLog.registroId, deal.id),
      eq(changeLog.campo, "ownerUserId"),
    ));
    expect(cambios).toHaveLength(1);
    expect(cambios[0].origen).toBe("app");
    expect((await db.select({ owner: deals.ownerUserId }).from(deals).where(eq(deals.id, deal.id)))[0].owner).toBe(nuevoDuenoId);
    expect((await db.select({ closer: calls.closerUserId }).from(calls).where(eq(calls.id, llamada.id)))[0].closer).toBe(closerId);

    const deshacer = contenido(await post("tools/call", {
      name: "preparar_accion",
      arguments: {
        programa: "reasignar-a",
        accion: "deshacer_evento",
        argumentos: { deal_id: deal.id, evento_id: eventoId },
      },
    }, tokenGerente))!;
    expect(deshacer.filas).toEqual([expect.objectContaining({ se_puede_aplicar: true })]);
    expect(contenido(await confirmar(deshacer.id as string))!.filas)
      .toEqual([expect.objectContaining({ estado: "aplicada" })]);
    expect((await db.select({ owner: deals.ownerUserId }).from(deals).where(eq(deals.id, deal.id)))[0].owner).toBe(closerId);
  });
});
