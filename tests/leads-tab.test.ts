import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deals, leadContactos, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leadsDelPrograma } from "@/lib/queries/leads";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA, sembrarEstadosDeLlegada } from "./helpers/programa-de-prueba";

/**
 * Ticket 072 — la tab Leads. Cada filtro es un hecho: con o sin deal vigente, el estado (o "sin
 * estado"), abandonó el formulario (solo parciales), posible duplicado y la fecha de la última
 * aplicación en Bogotá. El programa es frontera.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
const id: Record<string, string> = {};

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  await sembrarEstadosDeLlegada(db, programId);
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  const [u] = await db.insert(users).values({ email: "g@retiagrowth.com", rol: "gerente" }).returning();

  const filas = await db
    .insert(leads)
    .values([
      // 23:30 del 1-sep en Bogotá: ya es 2-sep en UTC. Tiene que contar como 1-sep.
      { programId, emailNormalizado: "con-deal@c.co", calificacion: "con_calendly", fechaUltimaAplicacion: new Date("2026-09-02T04:30:00Z") },
      { programId, emailNormalizado: "sin-estado@c.co", calificacion: null, fechaUltimaAplicacion: new Date("2026-09-10T15:00:00Z") },
      { programId, emailNormalizado: "parcial@c.co", calificacion: null, fechaUltimaAplicacion: new Date("2026-09-20T15:00:00Z") },
      { programId, emailNormalizado: "setteo@c.co", calificacion: "setteo_no_calificado", fechaUltimaAplicacion: new Date("2026-09-25T15:00:00Z") },
      { programId, emailNormalizado: "anulado@c.co", calificacion: "setteo_no_calificado", fechaUltimaAplicacion: new Date("2026-09-26T15:00:00Z") },
      { programId: q.id, emailNormalizado: "ajeno@c.co", calificacion: null },
    ])
    .returning();
  for (const l of filas) id[l.emailNormalizado.split("@")[0]] = l.id;

  await db.insert(deals).values([
    { leadId: id["con-deal"], programId, etapa: "agendado" },
    { leadId: id.anulado, programId, etapa: "pendiente_setteo", anuladoEn: new Date(), anuladoPor: u.id, motivoAnulacion: "error" },
  ]);
  await db.insert(submissions).values([
    { leadId: id.parcial, sourceId: f.id, token: "t1", esParcial: true },
    { leadId: id.setteo, sourceId: f.id, token: "t2", esParcial: true },
    { leadId: id.setteo, sourceId: f.id, token: "t2", esParcial: false },
  ]);
  await db.insert(leadContactos).values({ leadId: id.setteo, programId, tipo: "correo", valor: "otro@c.co", confirmado: false });
});

afterEach(async () => {
  await cerrar();
});

const correos = async (filtro: Parameters<typeof leadsDelPrograma>[2]) =>
  (await leadsDelPrograma(db, programId, filtro)).filas.map((f) => f.email).sort();

describe("leadsDelPrograma", () => {
  it("sin filtros trae los del programa, nunca los de otro", async () => {
    const r = await leadsDelPrograma(db, programId);
    expect(r.total).toBe(5);
    expect(r.filas.map((f) => f.email)).not.toContain("ajeno@c.co");
  });

  it("con y sin deal: un deal anulado no cuenta como deal", async () => {
    expect(await correos({ deal: "con" })).toEqual(["con-deal@c.co"]);
    expect(await correos({ deal: "sin" })).toEqual(["anulado@c.co", "parcial@c.co", "setteo@c.co", "sin-estado@c.co"]);
  });

  it("estado, y 'sin estado' para lo que llegó vacío", async () => {
    expect(await correos({ estado: "setteo_no_calificado" })).toEqual(["anulado@c.co", "setteo@c.co"]);
    expect(await correos({ estado: "sin_estado" })).toEqual(["parcial@c.co", "sin-estado@c.co"]);
  });

  it("'sin estado' incluye un valor que el programa no tiene; el filtro por valor no distingue mayusculas (117)", async () => {
    await db.insert(leads).values([
      { programId, emailNormalizado: "raro@c.co", calificacion: "valor_raro" },
      { programId, emailNormalizado: "mayus@c.co", calificacion: "SETTEO_no_calificado" },
    ]);
    expect(await correos({ estado: "sin_estado" })).toEqual(["parcial@c.co", "raro@c.co", "sin-estado@c.co"]);
    expect(await correos({ estado: "setteo_no_calificado" })).toEqual(["anulado@c.co", "mayus@c.co", "setteo@c.co"]);
    const { filas } = await leadsDelPrograma(db, programId);
    const de = Object.fromEntries(filas.map((f) => [f.email, f]));
    expect(de["raro@c.co"].estadoReconocido).toBe(false);
    expect(de["mayus@c.co"].estadoReconocido).toBe(true);
    expect(de["sin-estado@c.co"].estadoReconocido).toBe(false);
  });

  it("abandonó el formulario: solo quien tiene TODOS sus envíos parciales", async () => {
    expect(await correos({ abandono: true })).toEqual(["parcial@c.co"]);
  });

  it("posible duplicado y las marcas de cada fila", async () => {
    expect(await correos({ duplicado: true })).toEqual(["setteo@c.co"]);
    const { filas } = await leadsDelPrograma(db, programId);
    const de = Object.fromEntries(filas.map((f) => [f.email, f]));
    expect(de["setteo@c.co"]).toMatchObject({ correosSinConfirmar: 1, soloParciales: false, tieneDeal: false });
    expect(de["parcial@c.co"]).toMatchObject({ soloParciales: true });
    expect(de["con-deal@c.co"]).toMatchObject({ tieneDeal: true });
  });

  it("las fechas son días de Bogotá", async () => {
    const ultimo = (desde: string, hasta: string) => ({ fecha: { campo: "ultimo_envio" as const, rango: { desde, hasta } } });
    expect(await correos(ultimo("2026-09-01", "2026-09-01"))).toEqual(["con-deal@c.co"]);
    expect(await correos(ultimo("2026-09-02", "2026-09-20"))).toEqual(["parcial@c.co", "sin-estado@c.co"]);
  });
});
