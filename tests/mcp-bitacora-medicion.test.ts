import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { mcpLlamadas, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { datosDelInforme } from "@/scripts/informe-mcp";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});

beforeEach(async () => {
  await vaciar();
});

afterAll(async () => {
  estado.db = null;
  await cerrar();
});

function peticion(token: string) {
  return new Request("https://crm.retia.test/api/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: "programas_visibles", arguments: {} },
    }),
  });
}

describe("medición de llamadas MCP", () => {
  it("guarda bytes y consultas, y el informe ignora filas históricas nulas", async () => {
    await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "medicion",
      nombre: "Medición",
      ticketUsd: "797",
    });
    const [usuario] = await db.insert(users).values({
      email: "medicion-mcp@retia.test",
      nombre: "Medición MCP",
      rol: "developer",
    }).returning();
    const token = await emitirTokenPersonal(db, {
      userId: usuario.id,
      actorId: usuario.id,
      nombre: "Medición",
      scope: "lectura",
    });
    await db.insert(mcpLlamadas).values({
      tokenId: token.id,
      userId: usuario.id,
      herramienta: "historica",
      resultado: "ok",
    });

    const { POST } = await import("@/app/api/mcp/route");
    const respuesta = await POST(peticion(token.valor));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toContain("programas");

    const [medida] = await db.select().from(mcpLlamadas)
      .where(eq(mcpLlamadas.herramienta, "programas_visibles"));
    expect(medida.bytesRespuesta).toBeGreaterThan(0);
    expect(medida.consultas).toBeGreaterThanOrEqual(1);

    const informe = await datosDelInforme(
      db,
      new Date("2020-01-01T00:00:00.000Z"),
      new Date("2030-01-01T00:00:00.000Z"),
    );
    expect(informe.porHerramienta).toEqual(expect.arrayContaining([
      expect.objectContaining({ herramienta: "historica", bytesP50: null, consultasPromedio: null }),
      expect.objectContaining({ herramienta: "programas_visibles" }),
    ]));
  });
});
