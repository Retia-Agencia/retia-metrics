import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, deals, leadContactos, leads, miembrosPrograma, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { confirmarCorreo, separarCorreo } from "@/lib/ingesta/separar";
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

const PREGUNTA = "¿Cuál es tu correo electrónico?";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  const [u1, u2] = await db
    .insert(users)
    .values([
      { email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" },
      { email: "otro@retiagrowth.com", rol: "closer", closerId: "Otro" },
    ])
    .returning();
  await db.insert(miembrosPrograma).values({ userId: u1.id, programId, activo: true });
  closer = { id: u1.id, rol: "closer" };
  ajeno = { id: u2.id, rol: "closer" };

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
    const lista = await posiblesDuplicadosDelPrograma(db, programId);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ contactoId: marca, leadId: ana, correoSinConfirmar: "beto@c.co" });
  });
});

describe("confirmarCorreo", () => {
  it("quita la marca y deja rastro con quién", async () => {
    await confirmarCorreo(db, closer, { contactoId: marca });
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c.confirmado).toBe(true);
    const [r] = await db.select().from(changeLog).where(eq(changeLog.registroId, marca));
    expect(r).toMatchObject({ campo: "confirmado", valorAnterior: "false", valorNuevo: "true", userId: closer.id, origen: "app" });
    expect(await posiblesDuplicadosDelPrograma(db, programId)).toEqual([]);
  });

  it("un correo ya confirmado es 409", async () => {
    await confirmarCorreo(db, closer, { contactoId: marca });
    await expect(confirmarCorreo(db, closer, { contactoId: marca })).rejects.toMatchObject({ status: 409 });
  });
});

describe("separarCorreo", () => {
  it("deja dos leads: el correo y SUS envíos (el que lo trajo y el que lo trae) se van, el resto se queda", async () => {
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
  });

  it("si un envío que se movería abrió un deal vigente, 409 y nada cambia", async () => {
    await db.insert(deals).values({ leadId: ana, programId, etapa: "pendiente_setteo", submissionOrigenId: queTrajoABeto });

    await expect(separarCorreo(db, closer, { contactoId: marca })).rejects.toMatchObject({ status: 409 });

    expect(await db.select().from(leads)).toHaveLength(1);
    const [c] = await db.select().from(leadContactos).where(eq(leadContactos.id, marca));
    expect(c).toMatchObject({ leadId: ana, confirmado: false });
  });

  it("un closer sin membresía en el programa no puede (403); nada cambia", async () => {
    await expect(separarCorreo(db, ajeno, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    await expect(confirmarCorreo(db, ajeno, { contactoId: marca })).rejects.toMatchObject({ status: 403 });
    const [c] = await db
      .select()
      .from(leadContactos)
      .where(and(eq(leadContactos.id, marca), eq(leadContactos.confirmado, false)));
    expect(c).toBeDefined();
  });
});
