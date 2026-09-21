import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  changeLog,
  miembrosPrograma,
  leads,
  plataformasPago,
  productos,
  programs,
  sales,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { buscarPersonas, ventasDePersona } from "@/lib/queries/personas";

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
  await db.delete(sales);
  await db.delete(productos);
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
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
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

// ─────────────────────────────────────────────────────────── buscarPersonas

describe("buscarPersonas", () => {
  /**
   * El hueco del 18-sep: el alcance era SIEMPRE la membresia, sin mirar el rol. Un
   * gerente no necesita membresias, asi que no encontraba a nadie nunca, y como
   * `/personas/[id]` solo se alcanza desde el buscador, no tenia NINGUNA forma de
   * abrir el historial de un lead. La pregunta era del rol y se contestaba con la
   * membresia, misma familia que el bug de `/productos`.
   */
  it("un gerente busca en TODOS los programas activos, sin membresias", async () => {
    await sembrarPersona(programaA, { nombre: "Persona de A", emailNormalizado: "a@correo.co" });
    await sembrarPersona(programaB, { nombre: "Persona de B", emailNormalizado: "b@correo.co" });

    // El gerente no tiene ni una fila en miembros_programa, a proposito.
    const [g] = await db
      .insert(users)
      .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
      .returning();

    const resultados = await buscarPersonas(g.id, "gerente", "Persona", db);
    expect(resultados).toHaveLength(2);
    expect(resultados.map((r) => r.programaNombre).sort()).toEqual(["Programa A", "Programa B"]);
  });

  it("un developer tambien: no se le restringe nada (ADR 0025 punto 5)", async () => {
    await sembrarPersona(programaA, { nombre: "Persona de A", emailNormalizado: "a@correo.co" });
    await sembrarPersona(programaB, { nombre: "Persona de B", emailNormalizado: "b@correo.co" });

    const [d] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
      .returning();

    expect(await buscarPersonas(d.id, "developer", "Persona", db)).toHaveLength(2);
  });

  it("un programa INACTIVO no sale, ni siquiera para quien administra", async () => {
    await sembrarPersona(programaB, { nombre: "Persona de B", emailNormalizado: "b@correo.co" });
    await db.update(programs).set({ activo: false }).where(eq(programs.id, programaB));

    const [g] = await db
      .insert(users)
      .values({ email: "g2@retiagrowth.com", rol: "gerente", nombre: "G2" })
      .returning();

    expect(await buscarPersonas(g.id, "gerente", "Persona", db)).toHaveLength(0);
  });

  it("no cruza a programas donde el closer no vende", async () => {
    await sembrarPersona(programaB, { nombre: "Persona de B", emailNormalizado: "b@correo.co" });

    const resultados = await buscarPersonas(anaUserId, "closer", "Persona", db);
    expect(resultados).toHaveLength(0);
  });

  it("encuentra por nombre (insensible a mayusculas)", async () => {
    await sembrarPersona(programaA, { nombre: "Juan Pérez", emailNormalizado: "juan@correo.co" });

    const resultados = await buscarPersonas(anaUserId, "closer", "juan", db);
    expect(resultados).toHaveLength(1);
    expect(resultados[0].nombre).toBe("Juan Pérez");
    expect(resultados[0].programId).toBe(programaA);
    expect(resultados[0].programaNombre).toBe("Programa A");
  });

  it("encuentra por correo (insensible a mayusculas)", async () => {
    await sembrarPersona(programaA, { nombre: "Sin nombre útil", emailNormalizado: "buscame@correo.co" });

    const resultados = await buscarPersonas(anaUserId, "closer", "BUSCAME", db);
    expect(resultados).toHaveLength(1);
    expect(resultados[0].emailNormalizado).toBe("buscame@correo.co");
  });

  it("texto de menos de 2 caracteres no devuelve nada", async () => {
    await sembrarPersona(programaA, { nombre: "Ana", emailNormalizado: "a@correo.co" });

    expect(await buscarPersonas(anaUserId, "closer", "a", db)).toHaveLength(0);
    expect(await buscarPersonas(anaUserId, "closer", "", db)).toHaveLength(0);
    expect(await buscarPersonas(anaUserId, "closer", "  ", db)).toHaveLength(0);
  });

  it("expone el responsable de la persona", async () => {
    await sembrarPersona(programaA, {
      nombre: "Con responsable",
      emailNormalizado: "resp@correo.co",
      responsableCloserId: "Ana",
    });
    await sembrarPersona(programaA, {
      nombre: "Sin responsable",
      emailNormalizado: "libre@correo.co",
    });

    const conResp = await buscarPersonas(anaUserId, "closer", "resp@correo.co", db);
    expect(conResp[0].responsableCloserId).toBe("Ana");

    const sinResp = await buscarPersonas(anaUserId, "closer", "libre@correo.co", db);
    expect(sinResp[0].responsableCloserId).toBeNull();
  });

  it("devuelve a lo sumo 20 filas", async () => {
    for (let i = 0; i < 25; i++) {
      await sembrarPersona(programaA, {
        nombre: `Lead numero ${i}`,
        emailNormalizado: `lead${i}@correo.co`,
      });
    }
    const resultados = await buscarPersonas(anaUserId, "closer", "Lead numero", db);
    expect(resultados.length).toBeLessThanOrEqual(20);
  });
});

// ─────────────────────────────────────────────────────────── ventasDePersona

describe("ventasDePersona", () => {
  /** Siembra una venta de una persona y devuelve su id. */
  async function sembrarVenta(
    personId: string,
    programId: string,
    { precio = "797" as string | null, moneda = "USD" } = {},
  ): Promise<string> {
    const [venta] = await db
      .insert(sales)
      .values({
        personId,
        programId,
        closerId: "Ana",
        fecha: "2026-08-31",
        precioAplicadoUsd: precio,
        moneda,
      })
      .returning();
    return venta.id;
  }

  async function sembrarAbono(saleId: string, programId: string, monto: string): Promise<void> {
    await db
      .insert(abonos)
      .values({ saleId, programId, fecha: "2026-08-31", monto, closerId: "Ana" });
  }

  it("da el saldo correcto (precio menos lo abonado)", async () => {
    const personId = await sembrarPersona(programaA, { emailNormalizado: "compra@correo.co" });
    const saleId = await sembrarVenta(personId, programaA, { precio: "797" });
    await sembrarAbono(saleId, programaA, "300");
    await sembrarAbono(saleId, programaA, "200");

    const ventas = await ventasDePersona(personId, db);
    expect(ventas).toHaveLength(1);
    expect(Number(ventas[0].precioAplicadoUsd)).toBe(797);
    expect(Number(ventas[0].abonado)).toBe(500);
    expect(Number(ventas[0].saldo)).toBe(297);
    expect(ventas[0].moneda).toBe("USD");
  });

  it("una venta sin precio de contrato tiene saldo null (fila vieja de Sheets)", async () => {
    const personId = await sembrarPersona(programaA, { emailNormalizado: "vieja@correo.co" });
    const saleId = await sembrarVenta(personId, programaA, { precio: null });
    await sembrarAbono(saleId, programaA, "100");

    const ventas = await ventasDePersona(personId, db);
    expect(ventas).toHaveLength(1);
    expect(ventas[0].precioAplicadoUsd).toBeNull();
    expect(ventas[0].saldo).toBeNull();
    expect(Number(ventas[0].abonado)).toBe(100);
  });

  it("una venta sin abonos tiene abonado 0 y saldo = precio", async () => {
    const personId = await sembrarPersona(programaA, { emailNormalizado: "sinabono@correo.co" });
    await sembrarVenta(personId, programaA, { precio: "500" });

    const ventas = await ventasDePersona(personId, db);
    expect(ventas).toHaveLength(1);
    expect(Number(ventas[0].abonado)).toBe(0);
    expect(Number(ventas[0].saldo)).toBe(500);
  });
});
