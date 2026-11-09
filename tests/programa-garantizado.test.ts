import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, cohorts, deals, eventosMeta, leadContactos, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionForanea, nombreDeConstraint } from "@/lib/db/errores";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * Ticket 394, ADR 0125 — el programa de una fila hija lo garantiza la base (M4) y un programa con
 * historia no se borra (M5). Mordido en los dos sentidos: el hijo de OTRO programa choca con la FK
 * compuesta y el del MISMO programa convive. Sin esto, la frontera de programa vive solo en el
 * codigo y una cifra que cruza programas se ve creible, sin un solo error.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let leadA: string;
let leadB: string;
let cohorteB: string;
let dealA: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

afterAll(async () => {
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "A", ticketUsd: "1000" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "B", ticketUsd: "1000" }).returning();
  programaA = a.id;
  programaB = b.id;
  [{ id: leadA }] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaA, emailNormalizado: "a@correo.co" }).returning();
  [{ id: leadB }] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaB, emailNormalizado: "b@correo.co" }).returning();
  [{ id: cohorteB }] = await db.insert(cohorts).values({ programId: programaB, codigo: "CB", metaCupos: 1, precioUsd: "1" }).returning();
  [{ id: dealA }] = await db.insert(deals).values({ programId: programaA, leadId: leadA, etapa: "en_gestion" }).returning();
});

async function choca(promesa: Promise<unknown>, constraint: string): Promise<void> {
  const error = await promesa.then(() => null, (e: unknown) => e);
  expect(error, `debia chocar con ${constraint}`).not.toBeNull();
  expect(esViolacionForanea(error)).toBe(true);
  expect(nombreDeConstraint(error)).toBe(constraint);
}

function eqId(id: string) {
  return eq(programs.id, id);
}

describe("FK compuestas (id, program_id): el hijo es del programa de su padre", () => {
  it("un deal sobre el lead de otro programa choca", async () => {
    await choca(db.insert(deals).values({ programId: programaA, leadId: leadB, etapa: "en_gestion" }), "deals_lead_programa_fk");
  });

  it("un deal con la cohorte de otro programa choca; sin cohorte y con la de su programa convive", async () => {
    await choca(
      db.insert(deals).values({ programId: programaA, leadId: leadA, cohortId: cohorteB, etapa: "cierre_perdido" }),
      "deals_cohorte_programa_fk",
    );
    const [sinCohorte] = await db.insert(deals).values({ programId: programaA, leadId: leadA, etapa: "cierre_perdido" }).returning();
    expect(sinCohorte.cohortId).toBeNull();
    const [enB] = await db.insert(deals).values({ programId: programaB, leadId: leadB, cohortId: cohorteB, etapa: "en_gestion" }).returning();
    expect(enB.cohortId).toBe(cohorteB);
  });

  it("un contacto cuyo programa no es el de su lead choca", async () => {
    await choca(db.insert(leadContactos).values({ leadId: leadA, programId: programaB, tipo: "telefono", valor: "3001112222" }), "lead_contactos_lead_programa_fk");
    await db.insert(leadContactos).values({ leadId: leadA, programId: programaA, tipo: "telefono", valor: "3001112222" });
  });

  it("una llamada de otro programa que su deal choca; sin deal convive", async () => {
    await choca(db.insert(calls).values({ programId: programaB, dealId: dealA, resultado: "agendada" }), "calls_deal_programa_fk");
    await db.insert(calls).values({ programId: programaB, resultado: "agendada", huellaFila: "sin-deal" });
    await db.insert(calls).values({ programId: programaA, dealId: dealA, resultado: "agendada" });
  });

  it("un abono de otro programa que su deal choca", async () => {
    const abono = { dealId: dealA, fecha: "2026-09-15", monto: "40", moneda: "USD" };
    await choca(db.insert(abonos).values({ ...abono, programId: programaB }), "abonos_deal_programa_fk");
    await db.insert(abonos).values({ ...abono, programId: programaA });
  });

  it("un evento de Meta de otro programa que su deal choca", async () => {
    const evento = { dealId: dealA, evento: "purchase", eventId: "e1", eventTime: new Date() } as const;
    await choca(db.insert(eventosMeta).values({ ...evento, programId: programaB }), "eventos_meta_deal_programa_fk");
  });
});

describe("un programa con historia no se borra (restrict)", () => {
  it("borrar un programa con leads falla y no arrastra nada", async () => {
    const error = await db.delete(programs).where(eqId(programaA)).then(() => null, (e: unknown) => e);
    expect(esViolacionForanea(error)).toBe(true);
    expect(await db.select().from(leads)).toHaveLength(2);
    expect(await db.select().from(deals)).toHaveLength(1);
  });

  it("borrar un programa con solo una cohorte tambien falla", async () => {
    await db.delete(deals);
    await db.delete(leads);
    const error = await db.delete(programs).where(eqId(programaB)).then(() => null, (e: unknown) => e);
    expect(esViolacionForanea(error)).toBe(true); // queda la cohorte CB
    expect(await db.select().from(cohorts)).toHaveLength(1);
  });

  it("un programa sin nada se borra", async () => {
    const [vacio] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "vacio", nombre: "V", ticketUsd: "1" }).returning();
    await db.delete(programs).where(eqId(vacio.id));
    expect(await db.select().from(programs).where(eqId(vacio.id))).toHaveLength(0);
  });
});
