import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { abonos, calls, changeLog, cohorts, dealActividades, deals, leads, miembrosPrograma, plataformasPago, plataformasPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { pegarGrainMcp } from "@/lib/mcp/acciones/pegar-grain";
import { ErrorDeApp } from "@/lib/errors";
import { vigente } from "@/lib/queries/vigente";
import { registrarAbono } from "@/lib/deals/abonos";
import { marcarFallida } from "@/lib/deals/llamadas";
import { eventosDeshacibles } from "@/lib/deshacer/deshacer";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
const grain = vi.hoisted(() => ({ programarLectura: vi.fn() }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));
vi.mock("@/lib/grain/despues", () => ({
  programarLecturaDeGrain: grain.programarLectura,
}));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let closerId: string;
let otroCloserId: string;
let developerId: string;
let token: string;
let plataformaId: string;
let otraPlataformaId: string;
let cohorteId: string;

beforeAll(async () => { ({ db, cerrar, vaciar } = await crearBaseReutilizable()); estado.db = db; });
afterAll(async () => { estado.db = null; await cerrar(); });
afterEach(() => { vi.unstubAllGlobals(); });

beforeEach(async () => {
  grain.programarLectura.mockClear();
  await vaciar();
  const [programa, otro] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "ola-2", nombre: "Ola 2", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "ola-2-otro", nombre: "Ola 2 otro", ticketUsd: "1000" },
  ]).returning();
  programId = programa.id; otroProgramId = otro.id;
  const [closer, otroCloser, developer] = await db.insert(users).values([
    { email: "ola2@retia.co", nombre: "Closer ola 2", rol: "closer", closerId: "Closer ola 2" },
    { email: "otro-ola2@retia.co", nombre: "Otro closer", rol: "closer", closerId: "Otro closer" },
    { email: "developer-ola2@retia.co", nombre: "Developer ola 2", rol: "developer" },
  ]).returning();
  closerId = closer.id;
  otroCloserId = otroCloser.id;
  developerId = developer.id;
  await db.insert(miembrosPrograma).values([
    { userId: closerId, programId, calendlyEmail: "ola2@calendly.co" },
    { userId: otroCloserId, programId, calendlyEmail: "otro-ola2@calendly.co" },
  ]);
  token = (await emitirTokenPersonal(db, { userId: closerId, actorId: closerId, nombre: "Ola 2", scope: "escritura" })).valor;
  [plataformaId, otraPlataformaId] = (await db.insert(plataformasPago).values([{ nombre: "Wompi ola 2" }, { nombre: "PayPal ola 2" }]).returning()).map((x) => x.id);
  await db.insert(plataformasPrograma).values([{ programId, plataformaId }, { programId, plataformaId: otraPlataformaId }]);
  cohorteId = (await db.insert(cohorts).values({ programId, codigo: "O2", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2027-01-01", fechaInicioVentas: "2026-01-01", fechaCierreVentas: "2026-12-31", estado: "activo" }).returning())[0].id;
});

async function nuevoDeal(
  etapa: typeof deals.$inferInsert.etapa = "atendido",
  programa = programId,
  ownerUserId = closerId,
) {
  const [lead] = await db.insert(leads).values({ programId: programa, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, emailNormalizado: `${crypto.randomUUID()}@retia.co` }).returning();
  const [deal] = await db.insert(deals).values({ leadId: lead.id, programId: programa, ownerUserId, cohortId: programa === programId ? cohorteId : null, etapa, valorVendidoUsd: "1000" }).returning();
  return deal.id;
}

async function nuevaLlamada(dealId: string, resultado: typeof calls.$inferInsert.resultado = "agendada") {
  return (await db.insert(calls).values({ dealId, programId, closerUserId: closerId, emailLead: `${crypto.randomUUID()}@retia.co`, origen: "crm", resultado, fechaAgenda: new Date("2026-11-01T10:00:00-05:00") }).returning())[0].id;
}

function request(metodo: string, params: Record<string, unknown>, credencial = token) { return new Request("https://crm.retia.test/api/mcp", { method: "POST", headers: { authorization: `Bearer ${credencial}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: metodo, params }) }); }
async function post(metodo: string, params: Record<string, unknown>, credencial = token) { const { POST } = await import("@/app/api/mcp/route"); const respuesta = await POST(request(metodo, params, credencial)); const bruto = await respuesta.text(); const linea = bruto.startsWith("event:") ? bruto.split("\n").find((x) => x.startsWith("data: "))?.slice(6) ?? "{}" : bruto; return JSON.parse(linea) as Record<string, unknown>; }
function contenido(r: Record<string, unknown>) { return (r.result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent; }
function texto(r: Record<string, unknown>) { return ((r.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text) ?? JSON.stringify(r); }
async function preparar(accion: string, argumentos: Record<string, unknown>) { return contenido(await post("tools/call", { name: "preparar_accion", arguments: { programa: "ola-2", accion, argumentos } }))!; }
async function confirmar(id: string) { return contenido(await post("tools/call", { name: "confirmar_cambio", arguments: { id } }))!; }
async function aplicar(accion: string, argumentos: Record<string, unknown>) { const previa = await preparar(accion, argumentos); expect(previa.filas).toEqual([expect.objectContaining({ se_puede_aplicar: true })]); return confirmar(previa.id as string); }
async function deshacer(dealId: string, eventoId: string) { const previa = await preparar("deshacer_evento", { deal_id: dealId, evento_id: eventoId }); return confirmar(previa.id as string); }
function evento(resultado: Record<string, unknown>) { return (resultado.filas as { evento_id: string | null }[])[0].evento_id; }

type EscenarioMatriz = "otro_programa" | "otro_dueno" | "normal";

interface CasoMatriz {
  argumentos: Record<string, unknown>;
  snapshot: () => Promise<unknown>;
}

async function snapshotDeCaso(
  dealId: string,
  callIds: string[] = [],
): Promise<unknown> {
  const [deal] = await db.select({
    etapa: deals.etapa,
    pendiente: deals.pendiente,
    ownerUserId: deals.ownerUserId,
    anuladoEn: deals.anuladoEn,
    motivoAnulacion: deals.motivoAnulacion,
  }).from(deals).where(eq(deals.id, dealId));
  const llamadas = [];
  for (const callId of callIds) {
    const [llamada] = await db.select({
      id: calls.id,
      dealId: calls.dealId,
      resultado: calls.resultado,
      linkGrain: calls.linkGrain,
      anuladoEn: calls.anuladoEn,
      motivoAnulacion: calls.motivoAnulacion,
    }).from(calls).where(eq(calls.id, callId));
    llamadas.push(llamada);
  }
  const pagos = await db.select({
    id: abonos.id,
    plataformaId: abonos.plataformaId,
    anuladoEn: abonos.anuladoEn,
    motivoAnulacion: abonos.motivoAnulacion,
  }).from(abonos).where(eq(abonos.dealId, dealId)).orderBy(asc(abonos.id));
  return { deal, llamadas, pagos };
}

function fronteraDe(escenario: EscenarioMatriz) {
  return {
    programa: escenario === "otro_programa" ? otroProgramId : programId,
    ownerUserId: escenario === "otro_dueno" ? otroCloserId : closerId,
  };
}

async function casoDeLlamada(
  escenario: EscenarioMatriz,
  opciones: {
    etapa: typeof deals.$inferInsert.etapa;
    resultado: typeof calls.$inferInsert.resultado;
    argumentos: (dealId: string, callId: string) => Record<string, unknown>;
  },
): Promise<CasoMatriz> {
  const frontera = fronteraDe(escenario);
  const dealId = await nuevoDeal(opciones.etapa, frontera.programa, frontera.ownerUserId);
  const [llamada] = await db.insert(calls).values({
    dealId,
    programId: frontera.programa,
    closerUserId: frontera.ownerUserId,
    emailLead: `${crypto.randomUUID()}@retia.co`,
    origen: "crm",
    resultado: opciones.resultado,
    fechaAgenda: new Date("2026-11-01T10:00:00-05:00"),
  }).returning();
  return {
    argumentos: opciones.argumentos(dealId, llamada.id),
    snapshot: () => snapshotDeCaso(dealId, [llamada.id]),
  };
}

async function casoDeAbono(
  escenario: EscenarioMatriz,
  accion: "cambiar" | "anular",
): Promise<CasoMatriz> {
  const frontera = fronteraDe(escenario);
  const dealId = await nuevoDeal("atendido", frontera.programa, frontera.ownerUserId);
  const [abono] = await db.insert(abonos).values({
    dealId,
    programId: frontera.programa,
    fecha: "2026-11-13",
    monto: "25",
    moneda: "USD",
    concepto: "adicional",
    nota: "Mentoría",
    plataformaId,
    registradoPorUserId: frontera.ownerUserId,
  }).returning();
  return {
    argumentos: accion === "cambiar" ? {
      deal_id: dealId,
      abono_id: abono.id,
      plataforma_id: otraPlataformaId,
    } : {
      deal_id: dealId,
      abono_id: abono.id,
      motivo: "Duplicado",
    },
    snapshot: () => snapshotDeCaso(dealId),
  };
}

async function casoDeSuelta(escenario: EscenarioMatriz): Promise<CasoMatriz> {
  const programa = escenario === "otro_programa" ? otroProgramId : programId;
  const dealOwnerId = escenario === "otro_dueno" ? closerId : closerId;
  const hostId = escenario === "otro_dueno" ? otroCloserId : closerId;
  const dealId = await nuevoDeal("contactado", programa, dealOwnerId);
  const [llamada] = await db.insert(calls).values({
    programId: programa,
    closerUserId: hostId,
    calendlyHostEmail: escenario === "otro_dueno" ? "otro-ola2@calendly.co" : "ola2@calendly.co",
    emailLead: `${crypto.randomUUID()}@retia.co`,
    origen: "calendly",
    resultado: "agendada",
    fechaAgenda: new Date("2099-11-13T15:00:00Z"),
    huellaFila: `calendly:${crypto.randomUUID()}`,
  }).returning();
  return {
    argumentos: { deal_id: dealId, llamada_id: llamada.id },
    snapshot: () => snapshotDeCaso(dealId, [llamada.id]),
  };
}

const CASOS_OLA_2 = [
  {
    accion: "marcar_show",
    crear: (escenario: EscenarioMatriz) => casoDeLlamada(escenario, {
      etapa: "atendido",
      resultado: "agendada",
      argumentos: (dealId, callId) => ({ deal_id: dealId, llamada_id: callId }),
    }),
  },
  {
    accion: "pegar_grain",
    crear: (escenario: EscenarioMatriz) => casoDeLlamada(escenario, {
      etapa: "atendido",
      resultado: "agendada",
      argumentos: (dealId, callId) => ({
        deal_id: dealId,
        llamada_id: callId,
        link_grain: "https://grain.com/share/matriz",
      }),
    }),
  },
  {
    accion: "corregir_resultado",
    crear: (escenario: EscenarioMatriz) => casoDeLlamada(escenario, {
      etapa: "contactado",
      resultado: "show",
      argumentos: (dealId, callId) => ({
        deal_id: dealId,
        llamada_id: callId,
        resultado: "no_show",
        motivo: "Resultado equivocado",
      }),
    }),
  },
  {
    accion: "marcar_fallida",
    crear: (escenario: EscenarioMatriz) => casoDeLlamada(escenario, {
      etapa: "agendado",
      resultado: "agendada",
      argumentos: (dealId, callId) => ({
        deal_id: dealId,
        llamada_id: callId,
        resultado: "no_show",
      }),
    }),
  },
  { accion: "asignar_llamada_suelta", crear: casoDeSuelta },
  {
    accion: "registrar_abono",
    crear: async (escenario: EscenarioMatriz) => {
      const frontera = fronteraDe(escenario);
      const dealId = await nuevoDeal("atendido", frontera.programa, frontera.ownerUserId);
      return {
        argumentos: {
          deal_id: dealId,
          fecha: "2026-11-13",
          monto: "25",
          concepto: "adicional",
          nota: "Mentoría",
          plataforma_id: plataformaId,
          comprobante_url: "https://example.test/matriz",
        },
        snapshot: () => snapshotDeCaso(dealId),
      };
    },
  },
  { accion: "cambiar_plataforma_de_abono", crear: (escenario: EscenarioMatriz) => casoDeAbono(escenario, "cambiar") },
  {
    accion: "anular_deal",
    crear: async (escenario: EscenarioMatriz) => {
      const frontera = fronteraDe(escenario);
      const dealId = await nuevoDeal("atendido", frontera.programa, frontera.ownerUserId);
      return {
        argumentos: { deal_id: dealId, motivo: "Duplicado" },
        snapshot: () => snapshotDeCaso(dealId),
      };
    },
  },
  { accion: "anular_abono", crear: (escenario: EscenarioMatriz) => casoDeAbono(escenario, "anular") },
  {
    accion: "anular_llamada",
    crear: (escenario: EscenarioMatriz) => casoDeLlamada(escenario, {
      etapa: "atendido",
      resultado: "agendada",
      argumentos: (dealId, callId) => ({
        deal_id: dealId,
        llamada_id: callId,
        motivo: "Duplicada",
      }),
    }),
  },
] as const;

describe("acciones MCP ola 2", () => {
  it.each([
    ["marcar_show", async () => { const dealId = await nuevoDeal(); const callId = await nuevaLlamada(dealId); return { dealId, callId, args: { deal_id: dealId, llamada_id: callId }, campo: "resultado", antes: "agendada", despues: "show" }; }],
    ["pegar_grain", async () => { const dealId = await nuevoDeal(); const callId = await nuevaLlamada(dealId); return { dealId, callId, args: { deal_id: dealId, llamada_id: callId, link_grain: "https://grain.com/share/ola2" }, campo: "linkGrain", antes: null, despues: "https://grain.com/share/ola2" }; }],
    ["corregir_resultado", async () => { const dealId = await nuevoDeal("contactado"); const callId = await nuevaLlamada(dealId, "show"); return { dealId, callId, args: { deal_id: dealId, llamada_id: callId, resultado: "no_show", motivo: "Resultado equivocado" }, campo: "resultado", antes: "show", despues: "no_show" }; }],
  ] as const)("%s confirma, deja rastro mcp y no ofrece undo compuesto", async (accion, crear) => {
    const caso = await crear();
    const previa = await preparar(accion, caso.args);
    expect(previa.filas).toEqual([expect.objectContaining({ se_puede_aplicar: true })]);
    if (accion === "pegar_grain") expect(grain.programarLectura).not.toHaveBeenCalled();
    const resultado = await confirmar(previa.id as string);
    if (accion === "pegar_grain") {
      expect(grain.programarLectura).toHaveBeenCalledTimes(1);
      expect(grain.programarLectura).toHaveBeenCalledWith(caso.callId);
    }
    const eventoId = evento(resultado);
    expect(eventoId).toBeNull();
    expect(((await db.select().from(calls).where(eq(calls.id, caso.callId)))[0] as Record<string, unknown>)[caso.campo]).toBe(caso.despues);
    expect((await db.select().from(changeLog).where(eq(changeLog.registroId, caso.callId))).every((x) => x.origen === "mcp")).toBe(true);
    expect(((await db.select().from(calls).where(eq(calls.id, caso.callId)))[0] as Record<string, unknown>)[caso.campo]).toBe(caso.despues);
  });

  it("registrar_abono adicional confirma y su evento lo anula al deshacer", async () => {
    const dealId = await nuevoDeal();
    const resultado = await aplicar("registrar_abono", { deal_id: dealId, fecha: "2026-11-13", monto: "25", concepto: "adicional", nota: "Mentoría", plataforma_id: plataformaId, comprobante_url: "https://example.test/abono" });
    const eventoId = evento(resultado)!;
    const [abono] = await db.select().from(abonos).where(eq(abonos.dealId, dealId));
    expect(abono.origen).toBe("app");
    expect((await db.select().from(changeLog).where(eq(changeLog.registroId, abono.id))).every((x) => x.origen === "mcp")).toBe(true);
    await deshacer(dealId, eventoId);
    expect(await db.select().from(abonos).where(and(eq(abonos.id, abono.id), vigente(abonos)))).toHaveLength(0);
  });

  it("registrar_abono ticket deshace el abono y restaura etapa y pendiente", async () => {
    const dealId = await nuevoDeal("compromiso_verbal");
    const antes = (await db.select().from(deals).where(eq(deals.id, dealId)))[0];
    const resultado = await aplicar("registrar_abono", {
      deal_id: dealId,
      fecha: "2026-11-13",
      monto: "25",
      concepto: "ticket",
      plataforma_id: plataformaId,
      comprobante_url: "https://example.test/ticket",
    });
    const eventoId = evento(resultado);
    expect(eventoId).not.toBeNull();
    const [abono] = await db.select().from(abonos).where(eq(abonos.dealId, dealId));
    await deshacer(dealId, eventoId!);
    expect(await db.select().from(abonos).where(and(eq(abonos.id, abono.id), vigente(abonos)))).toHaveLength(0);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0]).toMatchObject({
      etapa: antes.etapa,
      pendiente: antes.pendiente,
    });
  });

  it("cambiar_plataforma_de_abono confirma, deja rastro mcp y, como en la app, no se deshace", async () => {
    const dealId = await nuevoDeal();
    const [abono] = await db.insert(abonos).values({ dealId, programId, fecha: "2026-11-13", monto: "25", moneda: "USD", concepto: "adicional", nota: "Mentoría", plataformaId, registradoPorUserId: closerId }).returning();
    const resultado = await aplicar("cambiar_plataforma_de_abono", { deal_id: dealId, abono_id: abono.id, plataforma_id: otraPlataformaId });
    expect((await db.select().from(abonos).where(eq(abonos.id, abono.id)))[0].plataformaId).toBe(otraPlataformaId);
    expect(evento(resultado)).toBeNull();
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.registroId, abono.id), eq(changeLog.campo, "plataformaId")));
    expect(rastro.map((fila) => fila.origen)).toEqual(["mcp"]);
  });

  it.each(["anular_deal", "anular_abono", "anular_llamada"] as const)("%s es definitiva, guarda motivo y origen mcp", async (accion) => {
    const dealId = await nuevoDeal();
    const motivo = "Duplicado confirmado";
    let argumentos: Record<string, unknown> = { deal_id: dealId, motivo };
    let tabla: typeof deals | typeof abonos | typeof calls = deals;
    let id = dealId;
    if (accion === "anular_abono") { const fila = (await db.insert(abonos).values({ dealId, programId, fecha: "2026-11-13", monto: "25", moneda: "USD", concepto: "adicional", nota: "Mentoría", plataformaId, registradoPorUserId: closerId }).returning())[0]; id = fila.id; tabla = abonos; argumentos = { ...argumentos, abono_id: id }; }
    if (accion === "anular_llamada") { id = await nuevaLlamada(dealId); tabla = calls; argumentos = { ...argumentos, llamada_id: id }; }
    const previa = await preparar(accion, argumentos);
    expect(previa.filas).toEqual([expect.objectContaining({ detalle: { aviso: "Una anulación no se puede deshacer." } })]);
    const resultado = await confirmar(previa.id as string);
    expect(evento(resultado)).toBeNull();
    expect(await db.select().from(tabla).where(and(eq(tabla.id, id), vigente(tabla)))).toHaveLength(0);
    const [fila] = await db.select().from(tabla).where(eq(tabla.id, id));
    expect(fila.motivoAnulacion).toBe(motivo);
    expect((await db.select().from(changeLog).where(eq(changeLog.registroId, id))).every((x) => x.origen === "mcp")).toBe(true);
  });

  it("otro programa queda oculto y no cambia", async () => {
    const dealId = await nuevoDeal("atendido", otroProgramId);
    const previa = await preparar("anular_deal", { deal_id: dealId, motivo: "No debe verse" });
    expect(previa.filas).toEqual([expect.objectContaining({ se_puede_aplicar: false, razon: "No existe ese deal" })]);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].anuladoEn).toBeNull();
  });

  it("registrar_abono rechaza sobrepago, plataforma inactiva y comprobante ausente", async () => {
    const dealId = await nuevoDeal("compromiso_verbal");
    await db.update(deals).set({ valorVendidoUsd: "100" }).where(eq(deals.id, dealId));
    const base = { deal_id: dealId, fecha: "2026-11-13", concepto: "ticket", plataforma_id: plataformaId, comprobante_url: "https://example.test/abono" };
    expect((await preparar("registrar_abono", { ...base, monto: "100.01" }).then((x) => x.filas) as { se_puede_aplicar: boolean }[])[0].se_puede_aplicar).toBe(false);
    const [inactiva] = await db.insert(plataformasPago).values({ nombre: "Inactiva ola 2", activo: false }).returning();
    await db.insert(plataformasPrograma).values({ programId, plataformaId: inactiva.id });
    expect((await preparar("registrar_abono", { ...base, monto: "50", plataforma_id: inactiva.id }).then((x) => x.filas) as { se_puede_aplicar: boolean }[])[0].se_puede_aplicar).toBe(false);
    const sinComprobante = await post("tools/call", { name: "preparar_accion", arguments: { programa: "ola-2", accion: "registrar_abono", argumentos: { deal_id: dealId, fecha: "2026-11-13", monto: "50", concepto: "ticket", plataforma_id: plataformaId } } });
    expect(texto(sinComprobante)).toContain("Sin el enlace del comprobante, el abono se registra a mano en la app");
    expect(await db.select().from(abonos).where(eq(abonos.dealId, dealId))).toHaveLength(0);
  });

  it("una huella de llamada cambiada entre preparar y confirmar rechaza sin aplicar", async () => {
    const dealId = await nuevoDeal();
    const callId = await nuevaLlamada(dealId);
    const previa = await preparar("marcar_show", { deal_id: dealId, llamada_id: callId });
    await db.update(calls).set({ linkGrain: "https://grain.com/share/cambio-app" }).where(eq(calls.id, callId));
    const resultado = await confirmar(previa.id as string);
    expect(resultado.filas).toEqual([expect.objectContaining({ estado: "rechazada", razon: "El deal cambió desde la vista previa." })]);
    expect((await db.select().from(calls).where(eq(calls.id, callId)))[0].resultado).toBe("agendada");
  });

  it.each(["registrar_abono", "cambiar_plataforma_de_abono", "anular_abono"] as const)(
    "%s rechaza si otro abono cambió el saldo después de preparar",
    async (accion) => {
      const dealId = await nuevoDeal();
      const [objetivo] = await db.insert(abonos).values({
        dealId,
        programId,
        fecha: "2026-11-12",
        monto: "20",
        moneda: "USD",
        concepto: "adicional",
        plataformaId,
        registradoPorUserId: closerId,
      }).returning();
      const argumentos = accion === "registrar_abono" ? {
        deal_id: dealId,
        fecha: "2026-11-13",
        monto: "25",
        concepto: "adicional",
        nota: "Mentoría concurrente",
        plataforma_id: plataformaId,
        comprobante_url: "https://example.test/nuevo",
      } : accion === "cambiar_plataforma_de_abono" ? {
        deal_id: dealId,
        abono_id: objetivo.id,
        plataforma_id: otraPlataformaId,
      } : {
        deal_id: dealId,
        abono_id: objetivo.id,
        motivo: "Duplicado",
      };
      const previa = await preparar(accion, argumentos);
      expect(previa.filas).toEqual([expect.objectContaining({ se_puede_aplicar: true })]);
      await registrarAbono(db, {
        userId: closerId,
        rol: "closer",
        operaComoCloser: false,
      }, {
        dealId,
        fecha: "2026-11-13",
        monto: "1",
        moneda: "USD",
        concepto: "adicional",
        nota: "Abono concurrente desde la app",
        plataformaId,
        comprobanteUrl: "https://example.test/app",
      }, { origen: "app" });
      const cantidadAntes = (await db.select().from(abonos).where(and(eq(abonos.dealId, dealId), vigente(abonos)))).length;
      const resultado = await confirmar(previa.id as string);
      expect(resultado.filas).toEqual([expect.objectContaining({
        estado: "rechazada",
        razon: "El deal cambió desde la vista previa.",
      })]);
      expect(await db.select().from(abonos).where(and(eq(abonos.dealId, dealId), vigente(abonos)))).toHaveLength(cantidadAntes);
      expect((await db.select().from(abonos).where(eq(abonos.id, objetivo.id)))[0]).toMatchObject({
        plataformaId,
        anuladoEn: null,
      });
    },
  );

  it("deshacer_evento restaura el pendiente de una llamada fallida", async () => {
    const dealId = await nuevoDeal("agendado");
    const callId = await nuevaLlamada(dealId);
    const actor = { userId: closerId, rol: "closer" as const, operaComoCloser: false };
    await marcarFallida(db, actor, { callId, resultado: "no_show" }, { origen: "app" });
    const resultado = (await eventosDeshacibles(db, actor, dealId)).find((fila) => (
      fila.tabla === "calls" && fila.resumen.some((campo) => campo.campo === "resultado")
    ));
    expect(resultado).toBeDefined();
    await deshacer(dealId, resultado!.id);
    expect((await db.select().from(calls).where(eq(calls.id, callId)))[0].resultado).toBe("agendada");
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].pendiente).toBeNull();
  });

  it.each(["agendado", "ganado_completo"] as const)(
    "marcar_fallida en %s: el pendiente de la vista previa es el que queda en la base",
    async (etapa) => {
      const dealId = await nuevoDeal(etapa);
      const callId = await nuevaLlamada(dealId);
      const previa = await preparar("marcar_fallida", { deal_id: dealId, llamada_id: callId, resultado: "no_show" });
      const [fila] = previa.filas as { se_puede_aplicar: boolean; despues: { pendiente: unknown; etapa: unknown } }[];
      expect(fila.se_puede_aplicar).toBe(true);
      await confirmar(previa.id as string);
      const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
      expect(fila.despues.pendiente).toBe(deal.pendiente);
      expect(fila.despues.etapa).toBe(deal.etapa);
      if (etapa === "ganado_completo") expect(deal.pendiente).not.toBe("reagenda");
      else expect(deal.pendiente).toBe("reagenda");
    },
  );

  it("marcar_fallida avisa de Calendly solo para una cancelada con cita futura", async () => {
    const dealId = await nuevoDeal("agendado");
    const [llamada] = await db.insert(calls).values({
      dealId,
      programId,
      closerUserId: closerId,
      emailLead: "calendly@retia.co",
      origen: "calendly",
      resultado: "agendada",
      fechaAgenda: new Date("2099-11-13T15:00:00Z"),
      huellaFila: "calendly:FUTURA",
    }).returning();
    const base = { deal_id: dealId, llamada_id: llamada.id };
    expect((await preparar("marcar_fallida", { ...base, resultado: "no_show" }).then((x) => x.filas) as Record<string, unknown>[])[0]).toMatchObject({
      efecto_externo: false,
    });
    expect((await preparar("marcar_fallida", { ...base, resultado: "cancelada" }).then((x) => x.filas) as Record<string, unknown>[])[0]).toMatchObject({
      efecto_externo: true,
      aviso: "También cancelará la cita en Calendly, y deshacer no la restaura.",
    });
  });

  it("Calendly falla después del commit: conserva la fallida, avisa y deja nota", async () => {
    await sembrarIntegracion(db, programId, "calendly", { token: "token", claveFirma: "clave" });
    const dealId = await nuevoDeal("agendado");
    const [llamada] = await db.insert(calls).values({
      dealId,
      programId,
      closerUserId: closerId,
      emailLead: "falla-calendly@retia.co",
      origen: "calendly",
      resultado: "agendada",
      fechaAgenda: new Date("2099-11-13T15:00:00Z"),
      huellaFila: "calendly:FALLA",
    }).returning();
    const fetch = vi.fn().mockRejectedValue(new Error("Calendly no responde"));
    vi.stubGlobal("fetch", fetch);
    const resultado = await aplicar("marcar_fallida", {
      deal_id: dealId,
      llamada_id: llamada.id,
      resultado: "cancelada",
    });
    expect(resultado.filas).toEqual([expect.objectContaining({
      estado: "aplicada",
      evento_id: null,
      aviso: "La cita en Calendly no se pudo cancelar; quedó pendiente y el deal tiene una nota para reintentar.",
    })]);
    expect((await db.select().from(calls).where(eq(calls.id, llamada.id)))[0].resultado).toBe("cancelada");
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId))).toEqual([
      expect.objectContaining({ nota: "La cita anterior de Calendly no se pudo cancelar. Reintenta la cancelación." }),
    ]);
  });

  it("un rechazo dentro de la transacción no llama Calendly", async () => {
    const dealId = await nuevoDeal("agendado");
    const [llamada] = await db.insert(calls).values({
      dealId,
      programId,
      closerUserId: closerId,
      emailLead: "rechazo@retia.co",
      origen: "calendly",
      resultado: "agendada",
      fechaAgenda: new Date("2099-11-13T15:00:00Z"),
      huellaFila: "calendly:RECHAZO",
    }).returning();
    const previa = await preparar("marcar_fallida", {
      deal_id: dealId,
      llamada_id: llamada.id,
      resultado: "cancelada",
    });
    await db.update(calls).set({ linkGrain: "https://grain.com/cambio" }).where(eq(calls.id, llamada.id));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await confirmar(previa.id as string)).filas).toEqual([expect.objectContaining({ estado: "rechazada" })]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pegar_grain no agenda la lectura de Grain si la fila falla antes del commit", async () => {
    const dealId = await nuevoDeal();
    const callId = await nuevaLlamada(dealId);
    const previa = await preparar("pegar_grain", { deal_id: dealId, llamada_id: callId, link_grain: "https://grain.com/share/rollback" });
    const original = pegarGrainMcp.aplicar.bind(pegarGrainMcp);
    const espia = vi.spyOn(pegarGrainMcp, "aplicar").mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new ErrorDeApp("Falla simulada antes del commit.", 500);
    });
    try {
      const resultado = await confirmar(previa.id as string);
      expect(resultado.filas).toEqual([expect.objectContaining({ estado: "rechazada" })]);
    } finally {
      espia.mockRestore();
    }
    expect(grain.programarLectura).not.toHaveBeenCalled();
    expect((await db.select().from(calls).where(eq(calls.id, callId)))[0].linkGrain).toBeNull();
  });

  it("asignar_llamada_suelta avisa solo cuando reemplaza una cita", async () => {
    await db.update(miembrosPrograma).set({ calendlyEmail: "host@calendly.co" })
      .where(eq(miembrosPrograma.userId, closerId));
    const dealId = await nuevoDeal("contactado");
    const crearSuelta = async (huella: string) => (await db.insert(calls).values({
      programId,
      closerUserId: closerId,
      calendlyHostEmail: "host@calendly.co",
      emailLead: `${huella}@retia.co`,
      origen: "calendly",
      resultado: "agendada",
      fechaAgenda: new Date("2099-11-14T15:00:00Z"),
      huellaFila: `calendly:${huella}`,
    }).returning())[0];
    const sinReemplazo = await crearSuelta("SIN-REEMPLAZO");
    expect((await preparar("asignar_llamada_suelta", {
      deal_id: dealId,
      llamada_id: sinReemplazo.id,
    }).then((x) => x.filas) as Record<string, unknown>[])[0]).toMatchObject({ efecto_externo: false });

    await db.insert(calls).values({
      dealId,
      programId,
      closerUserId: closerId,
      emailLead: "vieja@retia.co",
      origen: "calendly",
      resultado: "agendada",
      fechaAgenda: new Date("2099-11-13T15:00:00Z"),
      huellaFila: "calendly:VIEJA",
    });
    const conReemplazo = await crearSuelta("CON-REEMPLAZO");
    expect((await preparar("asignar_llamada_suelta", {
      deal_id: dealId,
      llamada_id: conReemplazo.id,
    }).then((x) => x.filas) as Record<string, unknown>[])[0]).toMatchObject({
      efecto_externo: true,
      aviso: "También cancelará la cita en Calendly, y deshacer no la restaura.",
    });
  });

  it.each(CASOS_OLA_2)(
    "$accion protege programa, dueño, scope de lectura y ver como",
    async ({ accion, crear }) => {
      const fetchCalendly = vi.fn().mockRejectedValue(new Error("Calendly no debe ejecutarse"));
      vi.stubGlobal("fetch", fetchCalendly);

      const ajeno = await crear("otro_programa");
      const ajenoAntes = await ajeno.snapshot();
      const previaAjena = await preparar(accion, ajeno.argumentos);
      expect(previaAjena.filas).toEqual([expect.objectContaining({
        se_puede_aplicar: false,
        razon: "No existe ese deal",
      })]);
      const forjada = await post("tools/call", {
        name: "preparar_accion",
        arguments: {
          programa: "ola-2-otro",
          accion,
          argumentos: ajeno.argumentos,
        },
      });
      expect(texto(forjada)).toContain("No existe ese programa");
      expect(await ajeno.snapshot()).toEqual(ajenoAntes);

      const deOtro = await crear("otro_dueno");
      const deOtroAntes = await deOtro.snapshot();
      const previaDeOtro = await preparar(accion, deOtro.argumentos);
      expect(previaDeOtro.filas).toEqual([expect.objectContaining({
        se_puede_aplicar: false,
        razon: expect.any(String),
      })]);
      const confirmacionDeOtro = await confirmar(previaDeOtro.id as string);
      expect(confirmacionDeOtro.filas).toEqual([expect.objectContaining({
        estado: "rechazada",
      })]);
      expect(await deOtro.snapshot()).toEqual(deOtroAntes);

      const lectura = await crear("normal");
      const lecturaAntes = await lectura.snapshot();
      const tokenLectura = await emitirTokenPersonal(db, {
        userId: closerId,
        actorId: closerId,
        nombre: `Lectura ${accion}`,
        scope: "lectura",
      });
      const capacidadesLectura = contenido(await post("tools/call", {
        name: "capacidades",
        arguments: {},
      }, tokenLectura.valor))!;
      expect((capacidadesLectura.acciones as { clave: string }[]).map((fila) => fila.clave)).not.toContain(accion);
      const herramientasLectura = await post("tools/list", {}, tokenLectura.valor);
      expect(JSON.stringify(herramientasLectura)).not.toContain(accion);
      const prepararLectura = await post("tools/call", {
        name: "preparar_accion",
        arguments: {
          programa: "ola-2",
          accion,
          argumentos: lectura.argumentos,
        },
      }, tokenLectura.valor);
      expect(texto(prepararLectura)).toMatch(/not found|No puedes/i);
      const confirmarLectura = await post("tools/call", {
        name: "confirmar_cambio",
        arguments: { id: crypto.randomUUID() },
      }, tokenLectura.valor);
      expect(texto(confirmarLectura)).toMatch(/not found|No puedes/i);
      expect(await lectura.snapshot()).toEqual(lecturaAntes);

      const verComo = await crear("normal");
      const verComoAntes = await verComo.snapshot();
      const tokenDeveloper = await emitirTokenPersonal(db, {
        userId: developerId,
        actorId: developerId,
        nombre: `Developer ${accion}`,
        scope: "escritura",
      });
      const preparadaDeveloper = contenido(await post("tools/call", {
        name: "preparar_accion",
        arguments: {
          programa: "ola-2",
          accion,
          argumentos: verComo.argumentos,
        },
      }, tokenDeveloper.valor))!;
      const capacidadesVerComo = contenido(await post("tools/call", {
        name: "capacidades",
        arguments: { vista: `usuario:${closerId}` },
      }, tokenDeveloper.valor))!;
      expect(capacidadesVerComo.acciones).toEqual([]);
      const prepararVerComo = await post("tools/call", {
        name: "preparar_accion",
        arguments: {
          vista: `usuario:${closerId}`,
          programa: "ola-2",
          accion,
          argumentos: verComo.argumentos,
        },
      }, tokenDeveloper.valor);
      expect(texto(prepararVerComo)).toContain("No puedes usar esta herramienta");
      const confirmarVerComo = await post("tools/call", {
        name: "confirmar_cambio",
        arguments: {
          vista: `usuario:${closerId}`,
          id: preparadaDeveloper.id,
        },
      }, tokenDeveloper.valor);
      expect(texto(confirmarVerComo)).toMatch(/403|permiso|herramienta/i);
      expect(await verComo.snapshot()).toEqual(verComoAntes);
      expect(fetchCalendly).not.toHaveBeenCalled();
    },
  );
});
