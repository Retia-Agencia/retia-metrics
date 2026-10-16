import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { llamadasDelPrograma, filtroDeLlamadasDesdeUrl } from "@/lib/queries/llamadas";
import { tieneGrain } from "@/lib/queries/sin-grain";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const programaVisiblePorSlug = vi.fn();
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug }));

let db: Db;
vi.mock("@/lib/db", () => ({ get db() { return db; } }));

const sesionGerente = {
  user: { id: "00000000-0000-4000-8000-000000000001", email: "gerente@example.test", rol: "gerente", closerId: null },
};

let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let closerPropio: string;
let closerAjeno: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  programaVisiblePorSlug.mockReset();

  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "visible", nombre: "Visible", ticketUsd: "1000" })
    .returning();
  programId = programa.id;
  const creados = await db
    .insert(users)
    .values([
      { id: sesionGerente.user.id, email: sesionGerente.user.email, rol: "gerente", nombre: "Gerencia" },
      { email: "propio@example.test", rol: "closer", nombre: "Closer Propio" },
      { email: "ajeno@example.test", rol: "closer", nombre: "Closer Ajeno" },
    ])
    .returning();
  closerPropio = creados[1].id;
  closerAjeno = creados[2].id;
  programaVisiblePorSlug.mockImplementation(
    async (_userId: string, _rol: string, slug: string) =>
      slug === "visible" ? { id: programId, slug: "visible", nombre: "Visible" } : null,
  );
});

afterAll(async () => {
  await cerrar();
});

async function crearLlamada({
  nombre,
  correo,
  ownerUserId,
  closerUserId = ownerUserId,
  linkGrain = "https://grain.com/grabacion",
  resultado = "show" as const,
  fecha = "2026-10-15T15:00:00Z",
  anulada = false,
}: {
  nombre: string;
  correo: string;
  ownerUserId: string;
  closerUserId?: string;
  linkGrain?: string | null;
  resultado?: "show" | "no_show";
  fecha?: string;
  anulada?: boolean;
}) {
  const [lead] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: correo, nombre })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({ programId, leadId: lead.id, ownerUserId, etapa: "agendado" })
    .returning();
  await db.insert(calls).values({
    programId,
    dealId: deal.id,
    closerUserId,
    linkGrain,
    resultado,
    fechaLlamada: new Date(fecha),
    anuladoEn: anulada ? new Date("2026-10-16T10:00:00Z") : null,
    anuladoPor: anulada ? sesionGerente.user.id : null,
    motivoAnulacion: anulada ? "Duplicada" : null,
  });
  return deal.id;
}

async function pedir(
  sesion: typeof sesionGerente | null,
  slug = "visible",
  query = "",
) {
  auth.mockResolvedValue(sesion);
  const { GET } = await import("@/app/(app)/p/[programa]/calls/grain.csv/route");
  return GET(new Request(`https://crm.example/p/${slug}/calls/grain.csv${query}`), {
    params: Promise.resolve({ programa: slug }),
  });
}

describe("GET /p/[programa]/calls/grain.csv", () => {
  it("sin sesión responde 401", async () => {
    expect((await pedir(null)).status).toBe(401);
  });

  it("un programa ajeno o inexistente responde 404", async () => {
    expect((await pedir(sesionGerente, "ajeno")).status).toBe(404);
  });

  it("un closer no recibe llamadas de otro aunque pase su id en el filtro", async () => {
    await crearLlamada({ nombre: "Propia", correo: "propia@example.test", ownerUserId: closerPropio });
    await crearLlamada({ nombre: "Ajena", correo: "ajena@example.test", ownerUserId: closerAjeno });
    const sesionCloser = {
      user: { id: closerPropio, email: "propio@example.test", rol: "closer", closerId: null },
    };

    const respuesta = await pedir(sesionCloser, "visible", `?closer=${closerAjeno}`);
    const csv = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(csv).toContain("Propia");
    expect(csv).not.toContain("Ajena");
  });

  it("excluye llamadas sin Grain y anuladas", async () => {
    await crearLlamada({ nombre: "Con Grain", correo: "grain@example.test", ownerUserId: closerPropio });
    await crearLlamada({ nombre: "Sin Grain", correo: "sin@example.test", ownerUserId: closerPropio, linkGrain: "  " });
    await crearLlamada({ nombre: "Anulada", correo: "anulada@example.test", ownerUserId: closerPropio, anulada: true });

    const csv = await (await pedir(sesionGerente)).text();

    expect(csv).toContain("Con Grain");
    expect(csv).not.toContain("Sin Grain");
    expect(csv).not.toContain("Anulada");
  });

  it("aplica los mismos filtros y orden de la lista, menos las llamadas sin Grain", async () => {
    await crearLlamada({ nombre: "Ana Z", correo: "ana-z@example.test", ownerUserId: closerPropio });
    await crearLlamada({ nombre: "Ana A", correo: "ana-a@example.test", ownerUserId: closerPropio, linkGrain: null });
    await crearLlamada({ nombre: "Ana No show", correo: "ana-no@example.test", ownerUserId: closerPropio, resultado: "no_show" });
    await crearLlamada({ nombre: "Ana Vieja", correo: "ana-vieja@example.test", ownerUserId: closerPropio, fecha: "2026-10-01T15:00:00Z" });
    const query = "?resultado=show&desde=2026-10-10&hasta=2026-10-16&q=Ana&orden=nombre%3Aasc";
    const parametros = new URL(`https://crm.example/${query}`).searchParams;
    const alcance = { tipo: "todos" as const };
    const filtro = await filtroDeLlamadasDesdeUrl(db, programId, alcance, parametros);
    const esperadas = (await llamadasDelPrograma(db, programId, alcance, filtro))
      .filter((fila) => tieneGrain(fila.linkGrain))
      .map((fila) => fila.leadNombre);

    const respuesta = await pedir(sesionGerente, "visible", query);
    const csv = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(esperadas).toEqual(["Ana Z"]);
    expect(csv).toContain("Ana Z");
    expect(csv).not.toContain("Ana A");
    expect(csv).not.toContain("Ana No show");
    expect(csv).not.toContain("Ana Vieja");
    expect(respuesta.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
    expect(respuesta.headers.get("content-disposition")).toMatch(/^attachment; filename="grain-visible-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(csv).toContain("https://crm.example/p/visible/deals/");
  });
});
