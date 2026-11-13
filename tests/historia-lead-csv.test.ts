import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { abonos, calls, dealEtapaHistorial, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
const programaVisiblePorSlug = vi.fn();
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug }));
let db: Db;
vi.mock("@/lib/db", () => ({ get db() { return db; } }));

const gerente = { user: { id: "00000000-0000-4000-8000-000000000001", email: "gerente@example.test", rol: "gerente" as const, closerId: null } };
const pauta = { user: { id: "00000000-0000-4000-8000-000000000002", email: "pauta@example.test", rol: "paid_trafficker" as const, closerId: null } };
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  programaVisiblePorSlug.mockReset();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "visible", nombre: "Visible", ticketUsd: "1000" }).returning();
  programId = programa.id;
  const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" }).returning();
  await db.insert(users).values([
    { ...gerente.user, nombre: "Gerencia" },
    { ...pauta.user, nombre: "Pauta" },
  ]);
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Formulario" }).returning();
  const creados = [];
  for (let i = 0; i < 51; i += 1) {
    const [lead] = await db.insert(leads).values({
      programId,
      emailNormalizado: `persona${i}@example.test`,
      nombre: `Persona ${i}`,
      telefono: `300${String(i).padStart(7, "0")}`,
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    }).returning();
    await db.insert(submissions).values({
      leadId: lead.id,
      sourceId: fuente.id,
      token: `token-${i}`,
      fechaEnvio: new Date(`2026-10-${String((i % 20) + 1).padStart(2, "0")}T10:00:00-05:00`),
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "Octubre",
      respuestas: { Pregunta: `Respuesta ${i}` },
    });
    creados.push(lead);
  }
  const [deal] = await db.insert(deals).values({
    programId,
    leadId: creados[0]!.id,
    ownerUserId: gerente.user.id,
    etapa: "agendado",
    valorVendidoUsd: "1000",
  }).returning();
  await db.insert(calls).values({
    programId,
    dealId: deal.id,
    closerUserId: gerente.user.id,
    resultado: "show",
    fechaLlamada: new Date("2026-10-22T10:00:00-05:00"),
    createdAt: new Date("2026-10-22T10:00:00-05:00"),
  });
  await db.insert(dealEtapaHistorial).values({
    dealId: deal.id,
    de: "registrado",
    a: "agendado",
    userId: gerente.user.id,
    fecha: new Date("2026-10-23T10:00:00-05:00"),
  });
  await db.insert(abonos).values({
    programId,
    dealId: deal.id,
    fecha: "2026-10-24",
    monto: "100",
    moneda: "USD",
    anuladoEn: new Date("2026-10-25T10:00:00-05:00"),
    anuladoPor: gerente.user.id,
    motivoAnulacion: "Duplicado",
  });
  const [ajeno] = await db.insert(leads).values({ programId: otro.id, emailNormalizado: "ajeno@example.test", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning();
  const [fuenteAjena] = await db.insert(sources).values({ programId: otro.id, nombre: "Ajena" }).returning();
  await db.insert(submissions).values({ leadId: ajeno.id, sourceId: fuenteAjena.id, token: "ajeno" });
  programaVisiblePorSlug.mockImplementation(async (_id: string, _rol: string, slug: string) =>
    slug === "visible" ? { id: programId, slug: "visible", nombre: "Visible" } : null,
  );
});

afterAll(async () => cerrar());

async function pedir(sesion: typeof gerente | typeof pauta, forma: "leads" | "traza", slug = "visible") {
  auth.mockResolvedValue(sesion);
  const { GET } = await import("@/app/(app)/p/[programa]/hub/lista.csv/route");
  const query = `metrica=registros&periodo=custom&a_desde=2026-10-01&a_hasta=2026-10-31&forma=${forma}`;
  return GET(new Request(`https://crm.example/p/${slug}/hub/lista.csv?${query}`), { params: Promise.resolve({ programa: slug }) });
}

describe("GET /p/[programa]/hub/lista.csv", () => {
  it("recorre todas las páginas y deja una fila por persona del programa", async () => {
    const texto = await (await pedir(gerente, "leads")).text();
    expect(texto.trim().split("\r\n")).toHaveLength(52);
    expect(texto).not.toContain("ajeno@example.test");
  });

  it("proyecta las columnas por capacidad sin ocultar contacto ni importe", async () => {
    const dePauta = await (await pedir(pauta, "leads")).text();
    const deGerencia = await (await pedir(gerente, "leads")).text();
    expect(dePauta.split("\r\n")[0]).toContain('"Correo","Teléfono","Etapa","Fecha","Importe"');
    expect(dePauta.split("\r\n")[0]).not.toContain("Closer");
    expect(dePauta).not.toMatch(/https?:\/\/|\/deals\/|[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(deGerencia.split("\r\n")[0]).toContain("Closer");
  });

  it("un programa ajeno responde 404", async () => {
    expect((await pedir(gerente, "leads", "ajeno")).status).toBe(404);
  });

  it("la traza trae envío, cita, etapa y abono en orden y sin cabeceras técnicas", async () => {
    const texto = await (await pedir(gerente, "traza")).text();
    const cabecera = texto.split("\r\n")[0]!;
    expect(cabecera.toLowerCase()).not.toContain("utm_");
    const posiciones = ["Envío", "Cita", "Etapa", "Abono"].map((evento) => texto.indexOf(`\"${evento}\"`));
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
    expect(texto).toContain('"Sí"');
  });
});
