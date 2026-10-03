import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  abonos,
  changeLog,
  miembrosPrograma,
  leads,
  plataformasPago,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { buscarLeads } from "@/lib/queries/leads";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 003 — lecturas de la pantalla `/mi-dia` (ADR 0021, 0023, 0011, 0005, 0013).
 *
 * Todo sobre PGlite en memoria: una sola base para el archivo (aplicar las
 * migraciones reales tarda segundos) y `limpiar()` entre tests, como en
 * `tests/registro-llamada.test.ts`. Se afirma leyendo lo que devuelve la interfaz
 * publica.
 *
 * El arrange siembra un closer (Ana) que vende SOLO en el programa A, y personas en
 * A y en B, para probar que el buscador no cruza a programas donde el closer no
 * vende (dedup por membresia activa, ADR 0021).
 */

let base: BaseDePrueba;
let db: Db;

let anaUserId: string;
let programaA: string;
let programaB: string;

/** Vacia en orden de llave foranea. */
async function limpiar(): Promise<void> {
  await db.delete(changeLog);
  await db.delete(abonos);
  await db.delete(leads);
  await db.delete(miembrosPrograma);
  await db.delete(programs);
  await db.delete(plataformasPago);
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

  const [ana] = await db
    .insert(users)
    .values({ email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  anaUserId = ana.id;

  const [a] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [b] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  // Ana vende SOLO en A.
  await db
    .insert(miembrosPrograma)
    .values({ userId: anaUserId, programId: programaA, activo: true });
});

/** Siembra una persona y devuelve su id. */
async function sembrarPersona(
  programId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const [p] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: "lead@correo.co", ...extra } as never)
    .returning();
  return p.id as string;
}

// ─────────────────────────────────────────────────────────── buscarLeads

describe("buscarLeads", () => {
  it("cada búsqueda queda acotada a un programa", async () => {
    await sembrarPersona(programaA, { nombre: "Persona de A", emailNormalizado: "a@correo.co" });
    await sembrarPersona(programaB, { nombre: "Persona de B", emailNormalizado: "b@correo.co" });

    expect((await buscarLeads(db, programaA, "Persona")).map((r) => r.nombre)).toEqual(["Persona de A"]);
    expect((await buscarLeads(db, programaB, "Persona")).map((r) => r.nombre)).toEqual(["Persona de B"]);
  });

  it("encuentra por nombre (insensible a mayusculas)", async () => {
    await sembrarPersona(programaA, { nombre: "Juan Pérez", emailNormalizado: "juan@correo.co" });

    const resultados = await buscarLeads(db, programaA, "juan");
    expect(resultados).toHaveLength(1);
    expect(resultados[0].nombre).toBe("Juan Pérez");
  });

  it("encuentra por correo (insensible a mayusculas)", async () => {
    await sembrarPersona(programaA, { nombre: "Sin nombre útil", emailNormalizado: "buscame@correo.co" });

    const resultados = await buscarLeads(db, programaA, "BUSCAME");
    expect(resultados).toHaveLength(1);
    expect(resultados[0].emailNormalizado).toBe("buscame@correo.co");
  });

  it("texto de menos de 2 caracteres no devuelve nada", async () => {
    await sembrarPersona(programaA, { nombre: "Ana", emailNormalizado: "a@correo.co" });

    expect(await buscarLeads(db, programaA, "a")).toHaveLength(0);
    expect(await buscarLeads(db, programaA, "")).toHaveLength(0);
    expect(await buscarLeads(db, programaA, "  ")).toHaveLength(0);
  });

  it("devuelve a lo sumo 20 filas", async () => {
    for (let i = 0; i < 25; i++) {
      await sembrarPersona(programaA, {
        nombre: `Lead numero ${i}`,
        emailNormalizado: `lead${i}@correo.co`,
      });
    }
    const resultados = await buscarLeads(db, programaA, "Lead numero");
    expect(resultados.length).toBeLessThanOrEqual(20);
  });
});
