import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { mcpLlamadas, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;
let token: { id: string; valor: string };

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});

beforeEach(async () => {
  await vaciar();
  await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "visible-a", nombre: "Visible A", ticketUsd: "797" });
  const [gerente] = await db.insert(users).values({ email: "gerente-rechazos@retia.test", nombre: "Gerente", rol: "gerente" }).returning();
  gerenteId = gerente.id;
  token = await emitirTokenPersonal(db, { userId: gerenteId, actorId: gerenteId, nombre: "Gerente", scope: "lectura" });
});

afterAll(async () => {
  estado.db = null;
  await cerrar();
});

async function llamar(nombre: string, argumentos: Record<string, unknown>) {
  const { POST } = await import("@/app/api/mcp/route");
  const respuesta = await POST(new Request("https://crm.retia.test/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token.valor}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: nombre, arguments: argumentos } }),
  }));
  const texto = await respuesta.text();
  const linea = texto.startsWith("event:") ? texto.split("\n").find((l) => l.startsWith("data: "))?.slice(6) : texto;
  return JSON.parse(linea ?? "{}") as { result?: { isError?: boolean; content: { text: string }[] }; error?: unknown };
}

const filas = () => db.select().from(mcpLlamadas).where(eq(mcpLlamadas.tokenId, token.id));

describe("rechazos de validación del MCP quedan en la bitácora", () => {
  it("periodo \"octubre\" (forjado): el esquema lo rechaza y deja una fila con quién, qué tool y qué campo", async () => {
    const respuesta = await llamar("resumen_del_hub", { programa: "visible-a", periodo: "octubre" });
    expect(JSON.stringify(respuesta)).toMatch(/validation|inválid|invalid/i);
    const registro = await filas();
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({
      userId: gerenteId, tokenId: token.id, herramienta: "resumen_del_hub",
      resultado: "error", codigoError: "ENTRADA_INVALIDA:periodo",
    });
  });

  it("no guarda el valor que mandó el cliente ni el nombre de una clave desconocida", async () => {
    await llamar("buscar_leads", { programa: "visible-a", texto: "ana@ejemplo.com", correo_secreto: "ana@ejemplo.com" });
    const registro = await filas();
    expect(registro).toHaveLength(1);
    expect(JSON.stringify(registro)).not.toContain("ana@ejemplo.com");
    expect(JSON.stringify(registro)).not.toContain("correo_secreto");
    expect(registro[0].codigoError).toMatch(/^ENTRADA_INVALIDA:/);
  });

  it("una llamada válida no deja fila extra y un mes AAAA-MM se acepta de punta a punta", async () => {
    const respuesta = await llamar("resumen_del_hub", { programa: "visible-a", periodo: "2026-10" });
    expect(respuesta.result?.isError).not.toBe(true);
    expect(respuesta.result?.content[0].text).toContain("2026-10-01 a 2026-10-31");
    const registro = await filas();
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({ resultado: "ok", codigoError: null });
  });
});
