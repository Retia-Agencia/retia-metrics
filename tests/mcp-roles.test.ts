import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { miembrosPrograma, mcpTokens, oauthCodigos, programs, usuariosProgramasAlcance, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rol } from "@/lib/auth/roles";
import { emitirParOauth } from "@/lib/oauth/emision";
import { herramientasPara, HERRAMIENTAS } from "@/lib/mcp/herramientas";
import { revocarConexionOauthAdministrada, revocarConexionOauthPropia } from "@/lib/oauth/conexiones";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;

type Actor = { id: string; rol: Rol; token: string; limitado: boolean };
let actores: Actor[];

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});

beforeEach(async () => {
  await vaciar();
  process.env.AUTH_URL = "http://localhost:3000";
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "visible-a", nombre: "Visible A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "fuera-b", nombre: "Fuera B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  programaB = b.id;
  const datos: Array<{ email: string; rol: Rol; limitado: boolean; membresia?: boolean }> = [
    { email: "gerente-global@retia.test", rol: "gerente", limitado: false },
    { email: "gerente-limitado@retia.test", rol: "gerente", limitado: true },
    { email: "closer-visible@retia.test", rol: "closer", limitado: true, membresia: true },
    { email: "closer-sin-programa@retia.test", rol: "closer", limitado: true },
    { email: "pauta@retia.test", rol: "paid_trafficker", limitado: true },
    { email: "students@retia.test", rol: "customer_success", limitado: true, membresia: true },
    { email: "media@retia.test", rol: "media", limitado: true },
  ];
  const filas = await db.insert(users).values(datos.map((dato) => ({ email: dato.email, rol: dato.rol }))).returning();
  actores = [];
  for (const [indice, usuario] of filas.entries()) {
    const dato = datos[indice];
    if (dato.membresia) await db.insert(miembrosPrograma).values({ userId: usuario.id, programId: programaA });
    if (dato.limitado && !dato.membresia) await db.insert(usuariosProgramasAlcance).values({ userId: usuario.id, programId: programaA });
    const [codigo] = await db.insert(oauthCodigos).values({
      hash: `codigo-${indice}`,
      userId: usuario.id,
      clientId: "https://cliente.example/oauth.json",
      redirectUri: "http://localhost/callback",
      codeChallenge: "a".repeat(43),
      scope: "lectura",
      resource: "http://localhost:3000/api/mcp",
      venceEn: new Date(Date.now() + 60_000),
    }).returning();
    const par = await emitirParOauth(db, { userId: usuario.id, clientId: "https://cliente.example/oauth.json", resource: "http://localhost:3000/api/mcp", scope: "lectura", codigoId: codigo.id });
    actores.push({ id: usuario.id, rol: dato.rol, token: par.accessToken, limitado: dato.limitado });
  }
});

afterAll(async () => { estado.db = null; delete process.env.AUTH_URL; await cerrar(); });

function peticion(metodo: string, params: Record<string, unknown>, token: string) {
  return new Request("http://localhost:3000/api/mcp", { method: "POST", headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  }, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: metodo, params }) });
}

async function post(metodo: string, params: Record<string, unknown>, token: string) {
  const { POST } = await import("@/app/api/mcp/route");
  return POST(peticion(metodo, params, token));
}

async function json(response: Response): Promise<Record<string, unknown>> {
  const texto = await response.text();
  const linea = texto.split("\n").find((parte) => parte.startsWith("data: "));
  return JSON.parse(linea?.slice(6) ?? texto) as Record<string, unknown>;
}

function contexto(actor: Actor) {
  return {
    db,
    tokenId: "test",
    escritura: false,
    rol: actor.rol,
    session: { expires: new Date(Date.now() + 60_000).toISOString(), user: { id: actor.id, rol: actor.rol, operaComoCloser: false, closerId: null, alcanceLimitado: actor.limitado } },
  };
}

function argumentos(nombre: string, programa: string): Record<string, unknown> {
  if (nombre === "consultar_metrica") return { programa, metrica: "ventas" };
  if (nombre === "ficha_de_lead" || nombre === "ficha_de_deal") return { programa, id: crypto.randomUUID() };
  return { programa };
}

describe("MCP por rol y alcance", () => {
  it("tools/list de cada actor sale del mismo registro que el servidor", async () => {
    for (const actor of actores) {
      const respuesta = await json(await post("tools/list", {}, actor.token));
      const recibidas = ((respuesta.result as { tools: Array<{ name: string }> }).tools).map((tool) => tool.name).sort();
      const esperadas = herramientasPara(contexto(actor)).map((tool) => tool.nombre).sort();
      expect(recibidas, `${actor.rol}:${actor.limitado ? "limitado" : "global"}`).toEqual(esperadas);
    }
  });

  it("Media solo recibe programas_visibles", () => {
    const actor = actores.find((item) => item.rol === "media")!;
    expect(herramientasPara(contexto(actor)).map((tool) => tool.nombre)).toEqual(["programas_visibles", "capacidades"]);
  });

  it("paid trafficker y Customer Success no reciben búsqueda global ni tablero de deals", () => {
    for (const rol of ["paid_trafficker", "customer_success"] as const) {
      const actor = actores.find((item) => item.rol === rol)!;
      const nombres = herramientasPara(contexto(actor)).map((tool) => tool.nombre);
      expect(nombres).not.toContain("buscar");
      expect(nombres).not.toContain("tablero_de_deals");
    }
  });

  it("rechaza cada herramienta forjada que no corresponde a cada actor", async () => {
    for (const actor of actores) {
      const permitidas = new Set(herramientasPara(contexto(actor)).map((tool) => tool.nombre));
      for (const herramienta of HERRAMIENTAS.filter((item) => !permitidas.has(item.nombre))) {
        const respuesta = await json(await post("tools/call", { name: herramienta.nombre, arguments: {} }, actor.token));
        const denegada = respuesta.error ?? ((respuesta.result as { isError?: boolean } | undefined)?.isError ? respuesta.result : undefined);
        expect(denegada, `${actor.rol}:${herramienta.nombre}`).toBeDefined();
      }
    }
  });

  it("un programa fuera del alcance se ve igual que uno inexistente", async () => {
    for (const actor of actores.filter((item) => item.limitado)) {
      const herramientas = herramientasPara(contexto(actor)).filter((tool) => tool.nombre !== "programas_visibles");
      for (const herramienta of herramientas) {
        const fuera = await json(await post("tools/call", { name: herramienta.nombre, arguments: argumentos(herramienta.nombre, "fuera-b") }, actor.token));
        const inexistente = await json(await post("tools/call", { name: herramienta.nombre, arguments: argumentos(herramienta.nombre, "no-existe") }, actor.token));
        expect(fuera.result, `${actor.rol}:${herramienta.nombre}`).toEqual(inexistente.result);
      }
    }
  });

  it("no permite desconectar una conexion propia enviando el id de otra persona", async () => {
    const [primero, segundo] = actores;
    const [tokenSegundo] = await db.select({ id: mcpTokens.id }).from(mcpTokens).where(eq(mcpTokens.userId, segundo.id));
    await expect(revocarConexionOauthPropia(db, { tokenId: tokenSegundo.id, userId: primero.id })).rejects.toMatchObject({ status: 403 });
    expect((await db.select().from(mcpTokens).where(eq(mcpTokens.id, tokenSegundo.id)))[0].revocadoEn).toBeNull();
  });

  it("la administracion no puede revocar fuera del alcance", async () => {
    const actor = actores.find((item) => item.rol === "gerente" && item.limitado)!;
    const fuera = actores.find((item) => item.rol === "gerente" && !item.limitado)!;
    await db.update(users).set({ rol: "closer" }).where(eq(users.id, fuera.id));
    await db.insert(miembrosPrograma).values({ userId: fuera.id, programId: programaB });
    const [tokenFuera] = await db.select({ id: mcpTokens.id }).from(mcpTokens).where(eq(mcpTokens.userId, fuera.id));
    await expect(revocarConexionOauthAdministrada(db, { tokenId: tokenFuera.id, actor: { id: actor.id, rol: actor.rol } })).rejects.toMatchObject({ status: 403 });
  });
});
