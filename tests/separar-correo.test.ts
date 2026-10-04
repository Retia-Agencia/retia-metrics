import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, deals, leadContactos, leads, miembrosPrograma, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { confirmarCorreo, separarCorreo } from "@/lib/ingesta/separar";
import { alertasDelDeal } from "@/lib/queries/ficha-deal";
import { posiblesDuplicadosDelPrograma } from "@/lib/queries/leads";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 072 — confirmar o separar un correo que entró por teléfono (ADR 0035). Decisiones del
 * 29-sep: se mueven los envíos que traen ESE correo exacto; si uno abrió un deal vigente, 409;
 * lo hace quien trabaja el programa.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let ana: string;
let marca: string;
let deAna: string;
let queTrajoABeto: string;
let otroDeBeto: string;
let closer: { id: string; rol: "closer" };
let ajeno: { id: string; rol: "closer" };
let gerente: { id: string; rol: "gerente" };

const PREGUNTA = "¿Cuál es tu correo electrónico?";

/** Un deal abierto sobre `ana`, con dueño, para que `closer` pueda decidir el duplicado (186). */
async function abrirDealDe(dueno: string | null, submissionOrigenId: string | null = deAna) {
  const [deal] = await db
    .insert(deals)
    .values({ leadId: ana, programId, etapa: "registrado", ownerUserId: dueno, submissionOrigenId })
    .returning();
  return deal;
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  const [u1, u2, u3] = await db
    .insert(users)
    .values([
      { email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" },
      { email: "otro@retiagrowth.com", rol: "closer", closerId: "Otro" },
      { email: "jefa@retiagrowth.com", rol: "gerente" },
    ])
    .returning();
  await db.insert(miembrosPrograma).values([
    { userId: u1.id, programId, activo: true },
    { userId: u2.id, programId, activo: true },
  ]);
  closer = { id: u1.id, rol: "closer" };
  ajeno = { id: u2.id, rol: "closer" };
  gerente = { id: u3.id, rol: "gerente" };

  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@c.co", nombre: "Ana", numAplicaciones: 3 }).returning();
  ana = l.id;
  const envio = (token: string, correo: string, dia: string) => ({
    leadId: ana,
    sourceId: f.id,
    token,
    fechaEnvio: new Date(`${dia}T15:00:00Z`),
    respuestas: { [PREGUNTA]: correo, "¿Tu WhatsApp?": "+57 300 000 0000" },
  });
  const [s1, s2, s3] = await db
    .insert(submissions)
    .values([envio("t1", "ana@c.co", "2026-08-01"), envio("t2", " Beto@C.co ", "2026-08-10"), envio("t3", "beto@c.co", "2026-09-01")])
    .returning();
  deAna = s1.id;
  queTrajoABeto = s2.id;
  otroDeBeto = s3.id;
  await db.insert(leadContactos).values([
    { leadId: ana, programId, tipo: "telefono", valor: "+573000000000", esPrincipal: true },
    { leadId: ana, programId, tipo: "correo", valor: "beto@c.co", submissionId: s2.id, confirmado: false },
  ]);
  const [m] = await db.select().from(leadContactos).where(eq(leadContactos.valor, "beto@c.co"));
  marca = m.id;
});

afterEach(async () => {
  await cerrar();
});

describe("posiblesDuplicadosDelPrograma", () => {
  it("lista el correo sin confirmar con su lead", async () => {
    const { total, filas } = await posiblesDuplicadosDelPrograma(db, programId);
    expect(total).toBe(1);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ contactoId: marca, leadId: ana, correoSinConfirmar: "beto@c.co" });
  });

  it("trae el dueño del deal abierto del lead", async () => {
    await abrirDealDe(closer.id);
    const { filas } = await posiblesDuplicadosDelPrograma(db, programId);
    expect(filas[0].duenoUserId).toBe(closer.id);
  });

  it("el closer ve solo los duplicados de SUS deals; otro dueño no los ve", async () => {
    await abrirDealDe(ajeno.id);
    const mios = await posiblesDuplicadosDelPrograma(db, programId, { duenoUserId: closer.id });
    expect(mios.total).toBe(0);
    expect(mios.filas).toHaveLength(0);
    const ajenos = await posiblesDuplicadosDelPrograma(db, programId, { duenoUserId: ajeno.id });
    expect(ajenos.total).toBe(1);
    expect(ajenos.filas[0]).toMatchObject({ contactoId: marca, duenoUserId: ajeno.id });
    // Quien administra (sin duenoUserId) ve el del programa igual.
    const todos = await posiblesDuplicadosDelPrograma(db, programId);
    expect(todos.total).toBe(1);
  });

  it("pagina de a 25 en el servidor y devuelve la segunda página", async () => {
    // 29 duplicados más: cada uno su lead y su correo marcado por teléfono.
    for (let i = 0; i < 29; i++) {
      const [l] = await db.insert(leads).values({ programId, emailNormalizado: `p${i}@c.co` }).returning();
      await db.insert(leadContactos).values({ leadId: l.id, programId, tipo: "correo", valor: `dup${i}@c.co`, confirmado: false });
    }
    const p0 = await posiblesDuplicadosDelPrograma(db, programId, { pagina: 0 });
    expect(p0.total).toBe(30);
    expect(p0.filas).toHaveLength(25);
    const p1 = await posiblesDuplicadosDelPrograma(db, programId, { pagina: 1 });
    expect(p1.total).toBe(30);
    expect(p1.filas).toHaveLength(5);
    // Ninguna fila se repite entre páginas.
    const ids = new Set([...p0.filas, ...p1.filas].map((f) => f.contactoId));
    expect(ids.size).toBe(30);
  });
});

describe("confirmarCorreo", () => {
  it("el dueño del deal abierto quita la marca y deja rastro con quién", async () => {
    await abrirDealDe(closer.id);
    await confirmarCorreo(db, closer, { contactoId: marca });
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c.confirmado).toBe(true);
    const [r] = await db.select().from(changeLog).where(and(eq(changeLog.registroId, marca), eq(changeLog.campo, "confirmado")));
    expect(r).toMatchObject({ campo: "confirmado", valorAnterior: "false", valorNuevo: "true", userId: closer.id, origen: "app" });
    expect((await posiblesDuplicadosDelPrograma(db, programId)).filas).toEqual([]);
  });

  it("un correo ya confirmado es 409", async () => {
    await abrirDealDe(closer.id);
    await confirmarCorreo(db, closer, { contactoId: marca });
    await expect(confirmarCorreo(db, closer, { contactoId: marca })).rejects.toMatchObject({ status: 409 });
  });
});

describe("separarCorreo", () => {
  it("el dueño deja dos leads: el correo y SUS envíos (el que lo trajo y el que lo trae) se van, el resto se queda", async () => {
    await abrirDealDe(closer.id);
    // El envío más reciente que se mueve manda: High abre el deal separado en Calificado.
    await db.update(submissions).set({ leadQuality: "High" }).where(eq(submissions.id, otroDeBeto));
    const r = await separarCorreo(db, closer, { contactoId: marca });

    expect(r.enviosMovidos).toBe(2);
    const [nuevo] = await db.select().from(leads).where(eq(leads.id, r.leadNuevoId));
    expect(nuevo).toMatchObject({ programId, emailNormalizado: "beto@c.co", numAplicaciones: 2 });
    const [original] = await db.select().from(leads).where(eq(leads.id, ana));
    expect(original.numAplicaciones).toBe(1);

    const envios = await db.select({ id: submissions.id, leadId: submissions.leadId }).from(submissions);
    const de = Object.fromEntries(envios.map((e) => [e.id, e.leadId]));
    expect(de[deAna]).toBe(ana);
    expect(de[queTrajoABeto]).toBe(r.leadNuevoId);
    expect(de[otroDeBeto]).toBe(r.leadNuevoId);

    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c).toMatchObject({ leadId: r.leadNuevoId, esPrincipal: true, confirmado: true });
    // El teléfono compartido se queda con el lead original.
    const tel = await db.select().from(leadContactos).where(eq(leadContactos.tipo, "telefono"));
    expect(tel[0].leadId).toBe(ana);

    const rastro = await db.select().from(changeLog).where(eq(changeLog.userId, closer.id));
    expect(rastro.filter((x) => x.tabla === "submissions")).toHaveLength(2);
    expect(rastro.some((x) => x.tabla === "leads" && x.registroId === r.leadNuevoId)).toBe(true);

    const [dealNuevo] = await db.select().from(deals).where(eq(deals.leadId, r.leadNuevoId));
    expect(dealNuevo).toMatchObject({
      programId,
      etapa: "calificado",
      submissionOrigenId: otroDeBeto,
    });
    const rastroDelDeal = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, dealNuevo.id)));
    expect(rastroDelDeal.length).toBeGreaterThan(0);
    expect(rastroDelDeal.every((fila) => fila.userId === null)).toBe(true);
  });

  it("si un envío que se movería abrió un deal vigente, 409 y nada cambia", async () => {
    const [deal] = await db
      .insert(deals)
      .values({ leadId: ana, programId, etapa: "registrado", ownerUserId: closer.id, submissionOrigenId: queTrajoABeto })
      .returning();

    await expect(separarCorreo(db, closer, { contactoId: marca })).rejects.toMatchObject({
      status: 409,
      dealId: deal.id,
      message: expect.stringContaining("Ábrelo"),
    });

    expect(await db.select().from(leads)).toHaveLength(1);
    expect(await db.select().from(deals)).toHaveLength(1);
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c).toMatchObject({ leadId: ana, confirmado: false });
  });

  it("la ficha del deal recibe los datos del posible duplicado y del envío que lo trajo", async () => {
    const [deal] = await db.insert(deals).values({ leadId: ana, programId, etapa: "registrado" }).returning();

    const alertas = await alertasDelDeal(db, programId, deal.id);

    expect(alertas?.posiblesDuplicados).toEqual([
      expect.objectContaining({
        contactoId: marca,
        correoPrincipal: "ana@c.co",
        correoSinConfirmar: "beto@c.co",
        telefonoEnComun: "+573000000000",
        envio: expect.objectContaining({ id: queTrajoABeto, fuente: "Typeform" }),
      }),
    ]);
  });

  it("un closer sin membresía en el programa no puede (403); nada cambia", async () => {
    const [u] = await db.insert(users).values({ email: "sin@retiagrowth.com", rol: "closer", closerId: "Sin" }).returning();
    const sinMembresia = { id: u.id, rol: "closer" as const };
    await expect(separarCorreo(db, sinMembresia, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    await expect(confirmarCorreo(db, sinMembresia, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    const [c] = await db
      .select()
      .from(leadContactos)
      .where(and(eq(leadContactos.id, marca), eq(leadContactos.confirmado, false)));
    expect(c).toBeDefined();
  });

  it("otro closer del MISMO programa (no dueño del deal) recibe 403 y la base no cambia", async () => {
    await abrirDealDe(closer.id);
    await expect(separarCorreo(db, ajeno, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    await expect(confirmarCorreo(db, ajeno, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c).toMatchObject({ leadId: ana, confirmado: false });
    expect(await db.select().from(leads)).toHaveLength(1);
    expect(await db.select().from(deals)).toHaveLength(1);
  });

  it("lead sin deal abierto: el closer no decide (403); quien administra sí", async () => {
    // Sin deal abierto en ana. El closer con membresía igual recibe 403.
    await expect(confirmarCorreo(db, ajeno, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    const [antes] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(antes.confirmado).toBe(false);
    // El gerente administra: confirma sin problema.
    await confirmarCorreo(db, gerente, { contactoId: marca });
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c.confirmado).toBe(true);
  });

  it("deal abierto SIN dueño: el closer no decide (403); quien administra separa", async () => {
    await abrirDealDe(null);
    await expect(confirmarCorreo(db, closer, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    const r = await separarCorreo(db, gerente, { contactoId: marca });
    expect(r.leadNuevoId).toBeDefined();
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c.leadId).toBe(r.leadNuevoId);
  });
});
