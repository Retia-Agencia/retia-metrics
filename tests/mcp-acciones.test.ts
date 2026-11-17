import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  changeLog,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  mcpLlamadas,
  mcpVistasPrevias,
  miembrosPrograma,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { moverEtapaMcp } from "@/lib/mcp/acciones/mover-etapa";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let closerId: string;
let otroCloserId: string;
let developerId: string;
let tokenEscritura: { id: string; valor: string };
let tokenLectura: { id: string; valor: string };

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
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "accion-a", nombre: "Acción A", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "accion-b", nombre: "Acción B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const [closer, otro, developer] = await db.insert(users).values([
    { email: "accion-closer@r.co", nombre: "Closer", rol: "closer", closerId: "Closer" },
    { email: "accion-otro@r.co", nombre: "Otro", rol: "closer", closerId: "Otro" },
    { email: "accion-dev@r.co", nombre: "Developer", rol: "developer" },
  ]).returning();
  closerId = closer.id;
  otroCloserId = otro.id;
  developerId = developer.id;
  await db.insert(miembrosPrograma).values([
    { userId: closerId, programId: programaA },
    { userId: otroCloserId, programId: programaA },
  ]);
  tokenEscritura = await emitirTokenPersonal(db, { userId: closerId, actorId: closerId, nombre: "Escritura", scope: "escritura" });
  tokenLectura = await emitirTokenPersonal(db, { userId: closerId, actorId: closerId, nombre: "Lectura", scope: "lectura" });
});

async function nuevoDeal(programId = programaA, ownerUserId = closerId) {
  const [lead] = await db.insert(leads).values({
    programId,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `${crypto.randomUUID()}@r.co`,
  }).returning();
  const [deal] = await db.insert(deals).values({ leadId: lead.id, programId, ownerUserId, etapa: "contactado" }).returning();
  await db.insert(dealActividades).values({ dealId: deal.id, tipo: "contacto", canal: "whatsapp", userId: ownerUserId });
  return deal.id;
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
  const texto = await respuesta.text();
  if (texto.startsWith("event:")) {
    const linea = texto.split("\n").find((parte) => parte.startsWith("data: "));
    return JSON.parse(linea?.slice(6) ?? "{}") as Record<string, unknown>;
  }
  return JSON.parse(texto) as Record<string, unknown>;
}

function contenido(respuesta: Record<string, unknown>) {
  return (respuesta.result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent;
}

function texto(respuesta: Record<string, unknown>) {
  return ((respuesta.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text) ?? JSON.stringify(respuesta);
}

async function preparar(dealId: string, token = tokenEscritura.valor, programa = "accion-a") {
  return post("tools/call", {
    name: "preparar_accion",
    arguments: {
      programa,
      accion: "mover_etapa",
      argumentos: { movimientos: [{ deal_id: dealId, a: "calificado" }] },
    },
  }, token);
}

async function confirmar(id: string, token = tokenEscritura.valor, extra: Record<string, unknown> = {}) {
  return post("tools/call", { name: "confirmar_cambio", arguments: { id, ...extra } }, token);
}

describe("acciones MCP", () => {
  it("un closer prepara y confirma; cambia etapa, deja historial y el deshacer deja todo change_log con origen mcp", async () => {
    const dealId = await nuevoDeal();
    const capacidades = contenido(await post("tools/call", { name: "capacidades", arguments: {} }, tokenEscritura.valor))!;
    expect((capacidades.acciones as { clave: string }[]).map((accion) => accion.clave)).toEqual([
      "mover_etapa", "deshacer_evento", "marcar_show", "pegar_grain", "corregir_resultado",
      "registrar_abono", "cambiar_plataforma_de_abono", "anular_deal", "anular_abono", "anular_llamada",
      "marcar_fallida", "asignar_llamada_suelta",
    ]);
    const previa = contenido(await preparar(dealId))!;
    expect((previa.filas as { se_puede_aplicar: boolean }[])[0].se_puede_aplicar).toBe(true);
    expect(previa.texto_para_la_persona).not.toContain(dealId);
    const confirmada = await confirmar(previa.id as string);
    expect(texto(confirmada)).not.toContain(dealId);
    const resultado = contenido(confirmada)!;
    const eventoId = (resultado.filas as { estado: string; evento_id: string }[])[0].evento_id;
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("calificado");
    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
    expect(historial).toHaveLength(1);
    expect(eventoId).toBe(historial[0].id);

    const deshacer = contenido(await post("tools/call", {
      name: "preparar_accion",
      arguments: { programa: "accion-a", accion: "deshacer_evento", argumentos: { deal_id: dealId, evento_id: eventoId } },
    }, tokenEscritura.valor))!;
    expect(deshacer.filas).toEqual([expect.objectContaining({ se_puede_aplicar: true })]);
    const resultadoDeshacer = contenido(await confirmar(deshacer.id as string))!;
    expect(resultadoDeshacer.filas).toEqual([expect.objectContaining({ estado: "aplicada" })]);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("contactado");
    const cambios = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(cambios.length).toBeGreaterThan(0);
    expect(cambios.every((fila) => fila.origen === "mcp")).toBe(true);
    expect(contenido(await confirmar(previa.id as string))).toEqual(resultado);
    const historialFinal = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
    expect(historialFinal).toHaveLength(2);
    // Migración 0135: el movimiento y el deshacer del MCP dejan su puerta en el historial.
    expect(historialFinal.map((fila) => fila.origen)).toEqual(["mcp", "mcp"]);
  });

  it("el historial de etapas guarda el origen de cada movimiento y ninguna fila nueva queda nula", async () => {
    const dealId = await nuevoDeal();
    const actor = { tipo: "usuario" as const, userId: closerId, rol: "closer" as const, operaComoCloser: false };
    await moverEtapa(db, { dealId, a: "calificado", actor });
    await moverEtapa(db, { dealId, a: "contactado", correccion: true, actor, origen: "mcp" });
    const filas = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
    expect(filas.map((fila) => fila.origen).sort()).toEqual(["app", "mcp"]);
    expect(filas.every((fila) => fila.origen !== null)).toBe(true);
  });

  it("solo un lugar inserta en deal_etapa_historial, y su tipo exige el origen", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const recorrer = (dir: string): string[] => readdirSync(dir).flatMap((nombre) => {
      const ruta = join(dir, nombre);
      return statSync(ruta).isDirectory() ? recorrer(ruta) : /\.tsx?$/.test(nombre) ? [ruta] : [];
    });
    const sitios = ["lib", "app", "scripts"].flatMap(recorrer)
      .flatMap((ruta) => (readFileSync(ruta, "utf8").match(/\.insert\(dealEtapaHistorial\)/g) ?? []).map(() => ruta));
    expect(sitios).toEqual([join("lib", "deals", "mover-etapa.ts")]);
    expect(readFileSync(join("lib", "deals", "mover-etapa.ts"), "utf8"))
      .toMatch(/type FilaDeHistorial = PgInsertValue<typeof dealEtapaHistorial> & \{ origen: OrigenOperativo \}/);
  });

  it("un moverEtapa con origen mcp marca todas las filas de change_log que produce", async () => {
    const dealId = await nuevoDeal();
    await moverEtapa(db, {
      dealId,
      a: "calificado",
      actor: { tipo: "usuario", userId: closerId, rol: "closer", operaComoCloser: false },
    });
    await moverEtapa(db, {
      dealId,
      a: "contactado",
      correccion: true,
      actor: { tipo: "usuario", userId: closerId, rol: "closer", operaComoCloser: false },
      origen: "mcp",
    });
    const cambios = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(cambios.length).toBeGreaterThan(0);
    expect(cambios.every((fila) => fila.origen === "mcp")).toBe(true);
  });

  it("oculta un deal de otro programa y al confirmar no lo mueve; un programa ajeno es 404", async () => {
    const ajeno = await nuevoDeal(programaB);
    const previa = contenido(await preparar(ajeno))!;
    expect(previa.filas).toEqual([expect.objectContaining({ se_puede_aplicar: false, razon: "No existe ese deal" })]);
    await confirmar(previa.id as string);
    expect((await db.select().from(deals).where(eq(deals.id, ajeno)))[0].etapa).toBe("contactado");
    expect(texto(await preparar(ajeno, tokenEscritura.valor, "accion-b"))).toContain("No existe ese programa");
  });

  it("rechaza el deal de otro dueño y continúa un lote", async () => {
    const uno = await nuevoDeal();
    const ajeno = await nuevoDeal(programaA, otroCloserId);
    const tres = await nuevoDeal();
    const previa = contenido(await post("tools/call", {
      name: "preparar_accion",
      arguments: { programa: "accion-a", accion: "mover_etapa", argumentos: { movimientos: [uno, ajeno, tres].map((deal_id) => ({ deal_id, a: "calificado" })) } },
    }, tokenEscritura.valor))!;
    const resultado = contenido(await confirmar(previa.id as string))!;
    expect((resultado.filas as { estado: string }[]).map((fila) => fila.estado)).toEqual(["aplicada", "rechazada", "aplicada"]);
    expect((await db.select().from(deals).where(eq(deals.id, ajeno)))[0].etapa).toBe("contactado");
  });

  it("confirmar dos veces devuelve el mismo resultado sin volver a mover, y una vista vencida da 409", async () => {
    const dealId = await nuevoDeal();
    const id = contenido(await preparar(dealId))!.id as string;
    const primera = contenido(await confirmar(id));
    const segunda = contenido(await confirmar(id));
    expect(segunda).toEqual(primera);
    expect(await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId))).toHaveLength(1);

    const otro = await nuevoDeal();
    const vencida = contenido(await preparar(otro))!.id as string;
    await db.update(mcpVistasPrevias).set({
      creadoEn: new Date(Date.now() - 20 * 60 * 1000),
      venceEn: new Date(Date.now() - 10 * 60 * 1000),
    }).where(eq(mcpVistasPrevias.id, vencida));
    expect(texto(await confirmar(vencida))).toContain("venció");
  });

  it("no confirma mover ni deshacer si el closer perdió el alcance después de preparar", async () => {
    const paraDeshacer = await nuevoDeal();
    await moverEtapa(db, {
      dealId: paraDeshacer,
      a: "calificado",
      actor: { tipo: "usuario", userId: closerId, rol: "closer", operaComoCloser: false },
    });
    const [evento] = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, paraDeshacer));
    const previaDeshacer = contenido(await post("tools/call", {
      name: "preparar_accion",
      arguments: {
        programa: "accion-a",
        accion: "deshacer_evento",
        argumentos: { deal_id: paraDeshacer, evento_id: evento.id },
      },
    }, tokenEscritura.valor))!;
    const paraMover = await nuevoDeal();
    const previaMover = contenido(await preparar(paraMover))!;

    await db.update(miembrosPrograma).set({ activo: false }).where(eq(miembrosPrograma.userId, closerId));

    expect(texto(await confirmar(previaDeshacer.id as string))).toContain("No existe ese programa");
    expect(texto(await confirmar(previaMover.id as string))).toContain("No existe ese programa");
    expect((await db.select().from(deals).where(eq(deals.id, paraDeshacer)))[0].etapa).toBe("calificado");
    expect((await db.select().from(deals).where(eq(deals.id, paraMover)))[0].etapa).toBe("contactado");
  });

  it("conserva solo filas comprometidas si una acción falla de forma no controlada", async () => {
    const ids = await Promise.all([nuevoDeal(), nuevoDeal(), nuevoDeal()]);
    const previa = contenido(await post("tools/call", {
      name: "preparar_accion",
      arguments: {
        programa: "accion-a",
        accion: "mover_etapa",
        argumentos: { movimientos: ids.map((deal_id) => ({ deal_id, a: "calificado" })) },
      },
    }, tokenEscritura.valor))!;
    const original = moverEtapaMcp.aplicar;
    let llamadas = 0;
    const espia = vi.spyOn(moverEtapaMcp, "aplicar").mockImplementation(async (...argumentos) => {
      llamadas += 1;
      if (llamadas === 2) throw new Error("Falla inyectada");
      return original(...argumentos);
    });
    try {
      expect(texto(await confirmar(previa.id as string))).toContain("Error interno");
    } finally {
      espia.mockRestore();
    }

    const estados = await Promise.all(ids.map(async (id) => (await db.select().from(deals).where(eq(deals.id, id)))[0].etapa));
    expect(estados).toEqual(["calificado", "contactado", "contactado"]);
    const [guardada] = await db.select().from(mcpVistasPrevias).where(eq(mcpVistasPrevias.id, previa.id as string));
    expect(guardada.resultado).toEqual([expect.objectContaining({ objetivo_id: ids[0], estado: "aplicada" })]);

    const reintento = contenido(await confirmar(previa.id as string))!;
    expect(reintento.filas).toEqual([
      expect.objectContaining({ objetivo_id: ids[0], estado: "aplicada" }),
      expect.objectContaining({ objetivo_id: ids[1], estado: "rechazada", razon: "No se aplicó: prepárala de nuevo." }),
      expect.objectContaining({ objetivo_id: ids[2], estado: "rechazada", razon: "No se aplicó: prepárala de nuevo." }),
    ]);
    expect(await db.select().from(dealEtapaHistorial)).toHaveLength(1);
  });

  it("rechaza una huella cambiada por la app", async () => {
    const dealId = await nuevoDeal();
    const id = contenido(await preparar(dealId))!.id as string;
    await moverEtapa(db, {
      dealId,
      a: "calificado",
      actor: { tipo: "usuario", userId: closerId, rol: "closer", operaComoCloser: false },
    });
    const resultado = contenido(await confirmar(id))!;
    expect(resultado.filas).toEqual([expect.objectContaining({ estado: "rechazada", razon: "El deal cambió desde la vista previa." })]);
    expect(await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId))).toHaveLength(1);
  });

  it("un token distinto del mismo usuario recibe 409 y no mueve la base", async () => {
    const dealId = await nuevoDeal();
    const id = contenido(await preparar(dealId))!.id as string;
    const segundo = await emitirTokenPersonal(db, { userId: closerId, actorId: closerId, nombre: "Otro", scope: "escritura" });
    expect(texto(await confirmar(id, segundo.valor))).toContain("no es de esta conexión");
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("contactado");
  });

  it("un token de lectura no descubre acciones y preparar o confirmar forzados fallan", async () => {
    const capacidades = contenido(await post("tools/call", { name: "capacidades", arguments: {} }, tokenLectura.valor))!;
    expect(capacidades.acciones).toEqual([]);
    const listado = await post("tools/list", {}, tokenLectura.valor);
    expect(JSON.stringify(listado)).not.toContain("preparar_accion");
    expect(JSON.stringify(listado)).not.toContain("confirmar_cambio");
    expect(texto(await preparar(await nuevoDeal(), tokenLectura.valor))).toContain("not found");
    expect(texto(await confirmar(crypto.randomUUID(), tokenLectura.valor))).toContain("not found");
  });

  it("developer con ver como no obtiene acciones ni fuerza escrituras o lecturas ajenas al rol efectivo", async () => {
    const token = await emitirTokenPersonal(db, { userId: developerId, actorId: developerId, nombre: "Dev", scope: "escritura" });
    const dealId = await nuevoDeal();
    const preparada = contenido(await preparar(dealId, token.valor))!;
    const capacidades = contenido(await post("tools/call", { name: "capacidades", arguments: { vista: `usuario:${closerId}` } }, token.valor))!;
    expect(capacidades.acciones).toEqual([]);
    const listado = await post("tools/list", { vista: `usuario:${closerId}` }, token.valor);
    expect(JSON.stringify(listado)).toContain("preparar_accion");
    expect(JSON.stringify(listado)).toContain("confirmar_cambio");
    expect(texto(await post("tools/call", {
      name: "preparar_accion",
      arguments: {
        vista: `usuario:${closerId}`,
        programa: "accion-a",
        accion: "mover_etapa",
        argumentos: { movimientos: [{ deal_id: dealId, a: "calificado" }] },
      },
    }, token.valor))).toContain("No puedes usar esta herramienta");
    expect(texto(await confirmar(preparada.id as string, token.valor, { vista: `usuario:${closerId}` }))).toMatch(/403|permiso|herramienta/i);

    const [paid] = await db.insert(users).values({ email: "vista-paid@r.co", nombre: "Paid", rol: "paid_trafficker" }).returning();
    expect(texto(await post("tools/call", {
      name: "buscar",
      arguments: { vista: `usuario:${paid.id}`, texto: "Ana" },
    }, token.valor))).toContain("No puedes usar esta herramienta");
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("contactado");
    const denegadas = (await db.select().from(mcpLlamadas).where(eq(mcpLlamadas.tokenId, token.id)))
      .filter((fila) => fila.resultado === "denegado");
    expect(denegadas.map((fila) => fila.herramienta)).toEqual(expect.arrayContaining(["preparar_accion", "confirmar_cambio", "buscar"]));
  });

  it.each(["paid_trafficker", "customer_success"] as const)("%s no puede preparar mover_etapa", async (rol) => {
    const [usuario] = await db.insert(users).values({ email: `${rol}@r.co`, nombre: rol, rol }).returning();
    await db.insert(miembrosPrograma).values({ userId: usuario.id, programId: programaA });
    const token = await emitirTokenPersonal(db, { userId: usuario.id, actorId: usuario.id, nombre: rol, scope: "escritura" });
    expect(texto(await preparar(await nuevoDeal(), token.valor))).toContain("No puedes usar esa acción");
  });
});
