import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { cohorts, dealActividades, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarDeal } from "@/lib/deals/editar-deal";
import { buscarMcp } from "@/lib/mcp/herramientas/operacion";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerenteId: string;
let closerId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "buscar-a", nombre: "ComunicArte", ticketUsd: "797" },
    { ...PROGRAMA_DE_PRUEBA, slug: "buscar-b", nombre: "Tactical", ticketUsd: "1500" },
  ]).returning();
  const [alejo, nicolas, gerente, closer] = await db.insert(users).values([
    { email: "alejo@retia.test", nombre: "Alejo Carvajal", rol: "closer", closerId: "alejo" },
    { email: "nicolas@retia.test", nombre: "Nicolás", rol: "closer", closerId: "nicolas" },
    { email: "mani@retia.test", nombre: "Mani", rol: "gerente" },
    { email: "otro@retia.test", nombre: "Otro", rol: "closer", closerId: "otro" },
  ]).returning();
  gerenteId = gerente.id;
  closerId = closer.id;
  await db.insert(miembrosPrograma).values([
    { userId: alejo.id, programId: a.id }, { userId: nicolas.id, programId: a.id }, { userId: closer.id, programId: a.id },
  ]);
  const [cohorte] = await db.insert(cohorts).values({ programId: a.id, codigo: "C-11", metaCupos: 10, precioUsd: "797", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01", estado: "activo" }).returning();
  const [personaA] = await db.insert(leads).values([
    { programId: a.id, emailNormalizado: "alexander-a@retia.test", nombre: "Alexander Ruiz", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA },
    { programId: b.id, emailNormalizado: "alexander-b@retia.test", nombre: "Alexander Tactical", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA },
  ]).returning();
  const [deal] = await db.insert(deals).values({ programId: a.id, leadId: personaA.id, cohortId: cohorte.id, ownerUserId: alejo.id, etapa: "calificado" }).returning();
  await db.insert(dealActividades).values({ dealId: deal.id, tipo: "nota", nota: "Seguimiento", userId: gerente.id, fecha: new Date("2026-11-09T10:00:00-05:00") });
  await editarDeal(db, { userId: gerente.id, rol: "gerente", operaComoCloser: false }, { dealId: deal.id, ownerUserId: nicolas.id });
});
afterAll(async () => cerrar());

function contexto(id: string, rol: ContextoMcp["rol"]): ContextoMcp {
  return { db, rol, tokenId: crypto.randomUUID(), escritura: false, session: { user: { id, rol, operaComoCloser: false, closerId: rol === "closer" ? "otro" : null, alcanceLimitado: rol === "closer" } } as Session };
}

describe("buscar global", () => {
  it("responde dueño y traspaso en una llamada, separado por programa", async () => {
    const salida = await buscarMcp.ejecutar(contexto(gerenteId, "gerente"), buscarMcp.entrada.parse({ texto: "Alexander" }));
    const secciones = salida.estructurado.programas as Array<{ total: number; filas: Array<{ deals?: Array<{ dueno: { nombre: string }; cohorte: { codigo: string }; ultimo_cambio_de_dueno: { de: string; a: string; por: string } }> }> }>;
    expect(secciones).toHaveLength(2);
    expect(salida.estructurado).not.toHaveProperty("total");
    expect(secciones[0].filas[0].deals?.[0]).toMatchObject({ dueno: { nombre: "Nicolás" }, cohorte: { codigo: "C-11" }, ultimo_cambio_de_dueno: { de: "Alejo Carvajal", a: "Nicolás", por: "Mani" } });
    expect(salida.texto).toContain("antes Alejo Carvajal");
    const completa = await buscarMcp.ejecutar(contexto(gerenteId, "gerente"), buscarMcp.entrada.parse({ texto: "Alexander", detalle: "completa" }));
    expect(completa.estructurado.programas).toBeTruthy();
  });

  it("el closer ve la persona sin el deal ajeno y no puede forjar programa", async () => {
    const ctx = contexto(closerId, "closer");
    const salida = await buscarMcp.ejecutar(ctx, buscarMcp.entrada.parse({ texto: "Alexander", programa: "buscar-a" }));
    const fila = (salida.estructurado.programas as Array<{ filas: Array<{ deals: unknown[] }> }>)[0].filas[0];
    expect(fila.deals).toEqual([]);
    await expect(buscarMcp.ejecutar(ctx, buscarMcp.entrada.parse({ texto: "Alexander", programa: "buscar-b" }))).rejects.toThrow("No existe ese programa");
    expect(buscarMcp.puede(contexto(gerenteId, "customer_success"))).toBe(false);
  });
});
