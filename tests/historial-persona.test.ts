import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  abonos,
  calls,
  changeLog,
  deals,
  cohorts,
  miembrosPrograma,
  motivos,
  origenes,
  leads,
  plataformasPago,
  productos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { historialDePersona } from "@/lib/queries/personas";

/**
 * Ticket 006 — historial de una persona (ADR 0013, 0015, 0021).
 *
 * Todo sobre PGlite en memoria: una sola base para el archivo (aplicar las
 * migraciones reales tarda segundos) y `limpiar()` entre tests, igual que
 * `tests/mi-dia.test.ts`. Se afirma leyendo lo que devuelve la interfaz publica,
 * nunca la forma interna de la consulta.
 */

let base: BaseDePrueba;
let db: Db;

let programaA: string;

/** Vacia en orden de llave foranea. */
async function limpiar(): Promise<void> {
  await db.delete(changeLog);
  await db.delete(abonos);
  await db.delete(calls);
  await db.delete(productos);
  await db.delete(leads);
  await db.delete(cohorts);
  await db.delete(miembrosPrograma);
  await db.delete(programs);
  await db.delete(plataformasPago);
  await db.delete(motivos);
  await db.delete(origenes);
  await db.delete(users);
}

beforeAll(async () => {
  base = await crearBaseDePrueba();
  db = base.db;
}, 60_000);
afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await limpiar();
  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
});

/**
 * Siembra el deal de un lead y devuelve su id. Una llamada cuelga del DEAL desde el
 * ADR 0037, asi que para que el historial de un lead tenga llamadas su deal tiene
 * que existir primero.
 */
async function sembrarDeal(leadId: string): Promise<string> {
  const [d] = await db.insert(deals).values({ leadId, programId: programaA }).returning();
  return d.id;
}

/** Siembra una persona y devuelve su id. */
async function sembrarPersona(extra: Record<string, unknown> = {}): Promise<string> {
  const [p] = await db
    .insert(leads)
    .values({
      programId: programaA,
      emailNormalizado: "lead@correo.co",
      nombre: "Lead de Prueba",
      ...extra,
    } as never)
    .returning();
  return p.id as string;
}

describe("historialDePersona", () => {
  it("una persona que no existe devuelve null (la pagina lo vuelve 404)", async () => {
    const historial = await historialDePersona(crypto.randomUUID(), db);
    expect(historial).toBeNull();
  });

  it("devuelve la persona con su programa", async () => {
    const id = await sembrarPersona();

    const historial = await historialDePersona(id, db);

    expect(historial?.persona.id).toBe(id);
    expect(historial?.persona.emailNormalizado).toBe("lead@correo.co");
    expect(historial?.persona.programaNombre).toBe("Programa A");
  });

  it("trae las llamadas de la persona, de la mas reciente a la mas vieja", async () => {
    const id = await sembrarPersona();
    const dealId = await sembrarDeal(id);
    await db.insert(calls).values([
      {
        dealId,
        programId: programaA,
        resultado: "no_show",
        fechaLlamada: new Date("2026-09-10T15:00:00Z"),
      },
      {
        dealId,
        programId: programaA,
        resultado: "show",
        fechaLlamada: new Date("2026-09-15T15:00:00Z"),
      },
    ] as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.llamadas.map((l) => l.resultado)).toEqual(["show", "no_show"]);
  });

  it("resuelve el motivo de perdida a su nombre, no a su uuid", async () => {
    const id = await sembrarPersona();
    const dealId = await sembrarDeal(id);
    const [motivo] = await db.insert(motivos).values({ nombre: "Sin presupuesto" }).returning();
    await db.insert(calls).values({
      dealId,
      programId: programaA,
      resultado: "perdida",
      motivoId: motivo.id,
      fechaLlamada: new Date("2026-09-15T15:00:00Z"),
    } as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.llamadas[0]?.motivoNombre).toBe("Sin presupuesto");
  });

  it("las llamadas de otra persona no se cuelan", async () => {
    const id = await sembrarPersona();
    const otra = await sembrarPersona({ emailNormalizado: "otra@correo.co" });
    const dealDeOtra = await sembrarDeal(otra);
    await db.insert(calls).values({
      dealId: dealDeOtra,
      programId: programaA,
      resultado: "show",
      fechaLlamada: new Date("2026-09-15T15:00:00Z"),
    } as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.llamadas).toEqual([]);
  });
});
