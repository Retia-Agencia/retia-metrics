import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  mcpLlamadas,
  miembrosPrograma,
  programs,
  usuariosProgramasAlcance,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal, revocarToken } from "@/lib/mcp/token";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null, fallarProgramas: false }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));
vi.mock("@/lib/auth/alcance", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/alcance")>();
  return {
    ...real,
    programasVisibles: (...args: Parameters<typeof real.programasVisibles>) => {
      if (estado.fallarProgramas) throw new Error("secreto-del-driver-no-debe-salir");
      return real.programasVisibles(...args);
    },
  };
});

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let closerId: string;
let gerenteId: string;
let developerId: string;
let tokenCloser: { id: string; valor: string };
let tokenGerente: { id: string; valor: string };
let tokenDeveloper: { id: string; valor: string };

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});

beforeEach(async () => {
  await vaciar();
  estado.fallarProgramas = false;
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "visible-a", nombre: "Visible A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "ajeno-b", nombre: "Ajeno B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const [closer, gerente, developer] = await db.insert(users).values([
    { email: "closer-mcp@retia.test", nombre: "Closer", rol: "closer", closerId: "Closer MCP" },
    { email: "gerente-mcp@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "developer-mcp@retia.test", nombre: "Developer", rol: "developer" },
  ]).returning();
  closerId = closer.id;
  gerenteId = gerente.id;
  developerId = developer.id;
  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programaA });
  await db.insert(usuariosProgramasAlcance).values({ userId: gerenteId, programId: programaB });
  tokenCloser = await emitirTokenPersonal(db, {
    userId: closerId, actorId: closerId, nombre: "Closer", scope: "lectura",
  });
  tokenGerente = await emitirTokenPersonal(db, {
    userId: gerenteId, actorId: gerenteId, nombre: "Gerente", scope: "lectura",
  });
  tokenDeveloper = await emitirTokenPersonal(db, {
    userId: developerId, actorId: developerId, nombre: "Developer", scope: "lectura",
  });
});

afterAll(async () => {
  estado.db = null;
  await cerrar();
});

function peticion(metodo: string, params: Record<string, unknown> | undefined, token?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("https://crm.retia.test/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: metodo, params }),
  });
}

async function post(metodo: string, params: Record<string, unknown> | undefined, token?: string) {
  const { POST } = await import("@/app/api/mcp/route");
  return POST(peticion(metodo, params, token));
}

async function json(response: Response): Promise<Record<string, unknown>> {
  const texto = await response.text();
  if (texto.startsWith("event:")) {
    const linea = texto.split("\n").find((parte) => parte.startsWith("data: "));
    return JSON.parse(linea?.slice(6) ?? "{}") as Record<string, unknown>;
  }
  return JSON.parse(texto) as Record<string, unknown>;
}

async function llamar(token: string, args: Record<string, unknown> = {}) {
  return json(await post("tools/call", { name: "programas_visibles", arguments: args }, token));
}

function estructurado(respuesta: Record<string, unknown>) {
  return (respuesta.result as { structuredContent?: { programas?: unknown[] } })?.structuredContent?.programas;
}

describe("ruta MCP real", () => {
  it("atiende initialize, tools/list y programas_visibles con un token válido", async () => {
    const inicial = await json(await post("initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "vitest", version: "1" },
    }, tokenCloser.valor));
    expect(inicial.result).toBeTruthy();
    const listado = await json(await post("tools/list", {}, tokenCloser.valor));
    expect((listado.result as { tools: { name: string }[] }).tools.map((t) => t.name))
      .toEqual(["programas_visibles", "consultar_metrica"]);
    expect(estructurado(await llamar(tokenCloser.valor))).toEqual([
      { nombre: "Visible A", slug: "visible-a" },
    ]);
  });

  it("sin token, falso, revocado o de usuario inactivo responde 401 vacío con challenge", async () => {
    const falso = `retia_mcp_${"a".repeat(43)}`;
    const revocado = await emitirTokenPersonal(db, {
      userId: closerId, actorId: closerId, nombre: "Revocado", scope: "lectura",
    });
    await revocarToken(db, { tokenId: revocado.id, actorId: closerId });
    const inactivo = await emitirTokenPersonal(db, {
      userId: gerenteId, actorId: gerenteId, nombre: "Inactivo", scope: "lectura",
    });
    await db.update(users).set({ activo: false }).where(eq(users.id, gerenteId));

    for (const token of [undefined, falso, revocado.valor, inactivo.valor]) {
      const respuesta = await post("tools/list", {}, token);
      expect(respuesta.status).toBe(401);
      expect(await respuesta.text()).toBe("");
      expect(respuesta.headers.get("www-authenticate"))
        .toContain("/.well-known/oauth-protected-resource/api/mcp");
    }
  });

  it("respeta el alcance del closer, del gerente limitado y del developer suplantado", async () => {
    expect(estructurado(await llamar(tokenCloser.valor))).toEqual([
      { nombre: "Visible A", slug: "visible-a" },
    ]);
    expect(JSON.stringify(await llamar(tokenCloser.valor))).not.toContain("ajeno-b");
    expect(estructurado(await llamar(tokenGerente.valor))).toEqual([
      { nombre: "Ajeno B", slug: "ajeno-b" },
    ]);
    expect(estructurado(await llamar(tokenDeveloper.valor, { vista: `usuario:${closerId}` })))
      .toEqual([{ nombre: "Visible A", slug: "visible-a" }]);
  });

  it("rechaza vista de un no-developer como error de herramienta", async () => {
    const respuesta = await llamar(tokenCloser.valor, { vista: "gerente" });
    const resultado = respuesta.result as { isError: boolean; content: { text: string }[] };
    expect(resultado.isError).toBe(true);
    expect(resultado.content[0].text).toBe("No puedes ver como otra persona.");
  });

  it("audita cada llamada sin argumentos de texto libre y registra a quién se suplantó", async () => {
    await llamar(tokenDeveloper.valor, { vista: `usuario:${closerId}` });
    const filas = await db.select().from(mcpLlamadas).where(eq(mcpLlamadas.tokenId, tokenDeveloper.id));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      userId: developerId, userIdVista: closerId, herramienta: "programas_visibles", resultado: "ok",
    });
    expect(JSON.stringify(filas)).not.toContain(`usuario:${closerId}`);
  });

  it("la llamada 301 recibe el tope, no ejecuta y queda auditada", async () => {
    await db.insert(mcpLlamadas).values(Array.from({ length: 300 }, () => ({
      tokenId: tokenCloser.id,
      userId: closerId,
      herramienta: "programas_visibles",
      resultado: "ok" as const,
    })));
    estado.fallarProgramas = true;
    const respuesta = await llamar(tokenCloser.valor);
    const resultado = respuesta.result as { isError: boolean; content: { text: string }[] };
    expect(resultado.isError).toBe(true);
    expect(resultado.content[0].text).toMatch(/^Muchas consultas seguidas: espera \d+ segundos\.$/);
    const filas = await db.select().from(mcpLlamadas).where(eq(mcpLlamadas.tokenId, tokenCloser.id));
    expect(filas).toHaveLength(301);
    expect(filas.at(-1)?.resultado).toBe("tope");
  });

  it("un error interno no filtra su detalle", async () => {
    estado.fallarProgramas = true;
    const respuesta = await llamar(tokenCloser.valor);
    const resultado = respuesta.result as { isError: boolean; content: { text: string }[] };
    expect(resultado.content[0].text).toBe("Error interno.");
    expect(JSON.stringify(respuesta)).not.toContain("secreto-del-driver-no-debe-salir");
  });

  it("publica ambas variantes de metadata sin sesión", async () => {
    const principal = await import("@/app/.well-known/oauth-protected-resource/route");
    const sufijo = await import("@/app/.well-known/oauth-protected-resource/api/mcp/route");
    for (const [ruta, GET] of [
      ["/.well-known/oauth-protected-resource", principal.GET],
      ["/.well-known/oauth-protected-resource/api/mcp", sufijo.GET],
    ] as const) {
      const respuesta = GET(new Request(`https://crm.retia.test${ruta}`));
      expect(respuesta.status).toBe(200);
      expect(await respuesta.json()).toMatchObject({ authorization_servers: [] });
    }
  });
});
