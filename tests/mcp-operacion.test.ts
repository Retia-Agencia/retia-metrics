import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { calls, cohorts, deals, leads, miembrosPrograma, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { bandejaMcp, buscarLeadsMcp, fichaDeDealMcp, fichaDeLeadMcp, tableroDeDealsMcp } from "@/lib/mcp/herramientas/operacion";
import { filtrosDeLeads } from "@/lib/queries/filtros-de-leads";
import { leadsDelPrograma } from "@/lib/queries/leads";
import { bandejaParaActor, fichaDeDealVisible, fichaDeLeadParaActor, tableroDeDealsParaActor } from "@/lib/queries/operacion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let closerId: string;
let otroCloserId: string;
let gerenteId: string;
let csId: string;
let leadId: string;
let dealId: string;
let dealAjenoId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  const [a] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "operacion-a", nombre: "Operación A", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "operacion-b", nombre: "Operación B", ticketUsd: "1500" },
  ]).returning();
  programaA = a.id;
  const [closer, otro, gerente, cs] = await db.insert(users).values([
    { email: "closer-operacion@retia.test", nombre: "Closer", rol: "closer", closerId: "Closer" },
    { email: "otro-operacion@retia.test", nombre: "Otro", rol: "closer", closerId: "Otro" },
    { email: "gerente-operacion@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "cs-operacion@retia.test", nombre: "CS", rol: "customer_success" },
  ]).returning();
  closerId = closer.id;
  otroCloserId = otro.id;
  gerenteId = gerente.id;
  csId = cs.id;
  await db.insert(miembrosPrograma).values([
    { userId: closerId, programId: programaA },
    { userId: otroCloserId, programId: programaA },
    { userId: csId, programId: programaA },
  ]);
  const [cohorte] = await db.insert(cohorts).values({
    programId: programaA,
    codigo: "A1",
    metaCupos: 10,
    precioUsd: "797",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-12-01",
    fechaInicioClases: "2026-12-02",
    estado: "activo",
  }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programaA, nombre: "Formulario" }).returning();
  const [lead, leadAjeno] = await db.insert(leads).values([
    { programId: programaA, emailNormalizado: "ana@retia.test", nombre: "Ana", telefono: "3001234567" },
    { programId: programaA, emailNormalizado: "beto@retia.test", nombre: "Beto" },
  ]).returning();
  leadId = lead.id;
  const [envio] = await db.insert(submissions).values({
    leadId,
    sourceId: fuente.id,
    token: "ana",
    fechaEnvio: new Date("2026-11-01T12:00:00-05:00"),
    respuestas: { Calendly: "https://calendly.test/secreto", Necesidad: "Vender más" },
  }).returning();
  const [propio, ajeno] = await db.insert(deals).values([
    { programId: programaA, leadId, submissionOrigenId: envio.id, cohortId: cohorte.id, ownerUserId: closerId, etapa: "agendado" },
    { programId: programaA, leadId: leadAjeno.id, cohortId: cohorte.id, ownerUserId: otroCloserId, etapa: "agendado" },
  ]).returning();
  dealId = propio.id;
  dealAjenoId = ajeno.id;
  await db.insert(calls).values({
    programId: programaA,
    dealId,
    closerUserId: closerId,
    closerId: "Closer",
    resultado: "agendada",
    fechaAgenda: new Date("2020-01-01T12:00:00-05:00"),
    emailLead: "ana@retia.test",
    origen: "calendly",
  });
}, 60_000);

afterAll(async () => cerrar());

function contexto(userId: string, rol: ContextoMcp["rol"]): ContextoMcp {
  const session = {
    user: {
      id: userId,
      email: `${rol}@retia.test`,
      name: rol,
      rol,
      operaComoCloser: false,
      closerId: rol === "closer" ? "Closer" : null,
      alcanceLimitado: rol === "closer" || rol === "customer_success",
    },
  } as Session;
  return { db, session, rol, tokenId: crypto.randomUUID(), escritura: false };
}

describe("herramientas MCP de operación", () => {
  it("buscar_leads conserva filtros y paginación de la función de la página", async () => {
    const entrada = { programa: "operacion-a", q: "ana", deal: "con" as const, pagina: 1 };
    const directo = await leadsDelPrograma(db, programaA, { ...filtrosDeLeads(entrada, 0).filtro, porPagina: 50 });
    const salida = await buscarLeadsMcp.ejecutar(contexto(gerenteId, "gerente"), entrada);
    const filas = salida.estructurado.filas as { id: string; enlace: string }[];
    expect(filas.map((fila) => fila.id)).toEqual(directo.filas.map((fila) => fila.id));
    expect(filas[0]?.enlace).toMatch(`/p/operacion-a/leads/${leadId}`);
  });

  it("un closer no puede forjar un programa fuera de sus membresías", async () => {
    await expect(buscarLeadsMcp.ejecutar(contexto(closerId, "closer"), {
      programa: "operacion-b", q: "ana", pagina: 1,
    })).rejects.toThrow("No existe ese programa");
  });

  it("ficha_de_lead aplica la misma proyección básica de Customer Success", async () => {
    const ctx = contexto(csId, "customer_success");
    const directo = await fichaDeLeadParaActor(db, programaA, leadId, { rol: "customer_success", operaComoCloser: false });
    const salida = await fichaDeLeadMcp.ejecutar(ctx, { programa: "operacion-a", id: leadId });
    const ficha = salida.estructurado.ficha as NonNullable<typeof directo>["ficha"];
    expect(salida.estructurado.basico).toBe(true);
    expect(ficha).toMatchObject(directo!.ficha);
    expect(JSON.stringify(ficha)).toContain("Enlace oculto");
    expect(JSON.stringify(ficha)).not.toContain("calendly.test/secreto");
  });

  it("ficha_de_deal conserva la ficha visible y oculta como 404 el deal de otro dueño", async () => {
    const ctx = contexto(closerId, "closer");
    const directo = await fichaDeDealVisible(db, programaA, dealId, ctx.session, "closer");
    const salida = await fichaDeDealMcp.ejecutar(ctx, { programa: "operacion-a", id: dealId });
    expect((salida.estructurado.ficha as { dealId: string }).dealId).toBe(directo!.ficha.dealId);
    await expect(fichaDeDealMcp.ejecutar(ctx, { programa: "operacion-a", id: dealAjenoId }))
      .rejects.toThrow("No existe ese deal");
  });

  it("tablero_de_deals conserva el resultado y las opciones de la composición de página", async () => {
    const ctx = contexto(closerId, "closer");
    const directo = await tableroDeDealsParaActor(db, programaA, ctx.session, { q: "ana", vista: "todo" });
    const salida = await tableroDeDealsMcp.ejecutar(ctx, { programa: "operacion-a", q: "ana", vista: "todo" });
    const tablero = salida.estructurado.tablero as { total: number; columnas: { tarjetas: { dealId: string; enlace: string }[] }[] };
    expect(tablero.total).toBe(directo.tablero.total);
    expect(tablero.columnas.flatMap((c) => c.tarjetas).map((t) => t.dealId)).toEqual([dealId]);
    expect(salida.estructurado.opciones).toMatchObject(directo.opciones);
  });

  it("bandeja conserva el alcance y las secciones de la composición de página", async () => {
    const ctx = contexto(closerId, "closer");
    const directo = await bandejaParaActor(db, programaA, ctx.session, "closer");
    const salida = await bandejaMcp.ejecutar(ctx, { programa: "operacion-a" });
    const inbox = salida.estructurado.inbox as { llamadasDeHoy: { dealId: string; enlace: string }[] };
    expect(inbox.llamadasDeHoy.map((fila) => fila.dealId)).toEqual(directo!.inbox.llamadasDeHoy.map((fila) => fila.dealId));
    expect(inbox.llamadasDeHoy[0]?.enlace).toMatch(`/p/operacion-a/deals/${dealId}`);
    expect(salida.estructurado.secciones).toMatchObject(directo!.secciones);
  });
});
