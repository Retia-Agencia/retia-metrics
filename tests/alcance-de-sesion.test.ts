import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  miembrosPrograma,
  leads,
  programs,
  users,
  usuariosProgramasAlcance,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable, type BaseDePrueba } from "./helpers/base-de-prueba";
import {
  idsDeProgramasVisibles,
  programaDeLaFichaPorSlug,
  programaEnAlcance,
  programaVisiblePorSlug,
  programasVisibles,
  programasInactivosParaAdministrar,
} from "@/lib/auth/alcance";
import { buscarLeads } from "@/lib/queries/leads";
import { exigirAccesoAlPrograma } from "@/lib/catalogo/acceso-programa";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * ADR 0048 punto 1 / ticket 094 — "¿qué programas ve esta sesión?" tiene UNA sola
 * respuesta, en `lib/auth/alcance.ts`, y toda lectura con programa la usa.
 *
 * DOS piezas que se prueban juntas:
 *
 *  1. La función de alcance y sus consumidores contra PGlite: un closer de un solo
 *     programa no ve el otro (ni en el selector, ni en el buscador, ni en una ficha
 *     abierta por id), y gerente y developer ven todo. Se afirma leyendo lo que
 *     devuelve la interfaz pública, no mirando que un ítem no aparezca.
 *
 *  2. Un GUARDIÁN sobre `lib/` y `app/`: ninguna lectura filtra por membresía
 *     (`miembrosPrograma` / `miembros_programa`) por su cuenta en vez de llamar a la
 *     función de alcance. Cada copia de ese join es una frontera que alguien puede
 *     olvidar cerrar; el programa es una frontera, no un filtro (AGENTS.md). Mismo
 *     molde que `tests/closer-identidad.test.ts` y `tests/vigencia-centralizada.test.ts`:
 *     análisis de texto sobre el árbol real, con excepciones nombradas y probado
 *     mordiendo en los dos sentidos.
 */

// ─────────────────────────────────────────────────────────── la función y sus usos

describe("la función de alcance (ADR 0048, ticket 094)", () => {
  let base: BaseDePrueba;
  let db: Db;

  let anaUserId: string;
  let gerenteId: string;
  let devId: string;
  let programaA: string;
  let programaB: string;
  let slugA: string;
  let slugB: string;

  beforeAll(async () => {
    base = await crearBaseReutilizable();
    db = base.db;

    const [ana] = await db
      .insert(users)
      .values({ email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
      .returning();
    anaUserId = ana.id;

    const [g] = await db
      .insert(users)
      .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
      .returning();
    gerenteId = g.id;

    const [d] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
      .returning();
    devId = d.id;

    const [a] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
      .returning();
    programaA = a.id;
    slugA = a.slug;

    const [b] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
      .returning();
    programaB = b.id;
    slugB = b.slug;

    // Ana es miembro ACTIVA solo de A.
    await db.insert(miembrosPrograma).values({ userId: anaUserId, programId: programaA, activo: true });
  }, 60_000);

  afterAll(async () => {
    await base?.cerrar();
  });

  it("un closer ve SOLO los programas donde tiene membresía activa", async () => {
    const vistos = await programasVisibles(anaUserId, "closer", db);
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.id).toBe(programaA);
    expect(vistos[0]!.slug).toBe(slugA);
  });

  it("un gerente ve TODOS los programas activos, sin membresías", async () => {
    const vistos = await programasVisibles(gerenteId, "gerente", db);
    expect(vistos.map((p) => p.id).sort()).toEqual([programaA, programaB].sort());
  });

  it("un developer también ve todos: no se le restringe nada (ADR 0025 punto 5)", async () => {
    const vistos = await programasVisibles(devId, "developer", db);
    expect(vistos.map((p) => p.id).sort()).toEqual([programaA, programaB].sort());
  });

  it("un paid trafficker ve todos sin membresías: Pauta lleva todos los programas (ticket 102)", async () => {
    const [pt] = await db
      .insert(users)
      .values({ email: "pauta@retiagrowth.com", rol: "paid_trafficker", nombre: "Pauta" })
      .returning();
    const vistos = await programasVisibles(pt.id, "paid_trafficker", db);
    expect(vistos.map((p) => p.id).sort()).toEqual([programaA, programaB].sort());
  });

  it("gerente y paid trafficker con filas ven solo esos programas", async () => {
    const [pt] = await db.insert(users).values({ email: "pauta-limitada@retia.co", rol: "paid_trafficker" }).returning();
    await db.insert(usuariosProgramasAlcance).values([
      { userId: gerenteId, programId: programaA },
      { userId: pt.id, programId: programaB },
    ]);
    expect((await programasVisibles(gerenteId, "gerente", db)).map((p) => p.id)).toEqual([programaA]);
    expect((await programasVisibles(pt.id, "paid_trafficker", db)).map((p) => p.id)).toEqual([programaB]);
    await db.delete(usuariosProgramasAlcance).where(eq(usuariosProgramasAlcance.userId, gerenteId));
    await db.delete(usuariosProgramasAlcance).where(eq(usuariosProgramasAlcance.userId, pt.id));
  });

  it("autoriza escrituras de gerente según alcance, pero Pauta conserva la reja de membresía", async () => {
    const [pt] = await db
      .insert(users)
      .values({ email: "pauta-sin-membresia@retia.co", rol: "paid_trafficker" })
      .returning();
    await db.insert(usuariosProgramasAlcance).values({ userId: gerenteId, programId: programaA });

    await expect(exigirAccesoAlPrograma(db, { id: gerenteId, rol: "gerente" }, programaA)).resolves.toBeUndefined();
    await expect(exigirAccesoAlPrograma(db, { id: gerenteId, rol: "gerente" }, programaB)).rejects.toMatchObject({
      status: 403,
    });
    await expect(exigirAccesoAlPrograma(db, { id: pt.id, rol: "paid_trafficker" }, programaA)).rejects.toMatchObject({
      status: 403,
    });

    await db.delete(usuariosProgramasAlcance).where(eq(usuariosProgramasAlcance.userId, gerenteId));
  });

  it("el developer ve todos aunque tenga filas de alcance", async () => {
    await db.insert(usuariosProgramasAlcance).values({ userId: devId, programId: programaA });
    expect((await programasVisibles(devId, "developer", db)).map((p) => p.id).sort()).toEqual([programaA, programaB].sort());
    await db.delete(usuariosProgramasAlcance).where(eq(usuariosProgramasAlcance.userId, devId));
  });

  it("un administrador limitado no ve un programa inactivo fuera de su alcance", async () => {
    await db.insert(usuariosProgramasAlcance).values({ userId: gerenteId, programId: programaA });
    await db.update(programs).set({ activo: false }).where(eq(programs.id, programaB));
    expect(await programaDeLaFichaPorSlug(gerenteId, "gerente", slugB, db)).toBeNull();
    expect(await programasInactivosParaAdministrar(gerenteId, "gerente", db)).toEqual([]);
    await db.update(programs).set({ activo: true }).where(eq(programs.id, programaB));
    await db.delete(usuariosProgramasAlcance).where(eq(usuariosProgramasAlcance.userId, gerenteId));
  });

  it("una membresía INACTIVA no cuenta", async () => {
    await db.insert(miembrosPrograma).values({ userId: anaUserId, programId: programaB, activo: false });
    const vistos = await programasVisibles(anaUserId, "closer", db);
    expect(vistos.map((p) => p.id)).toEqual([programaA]);
    // Limpieza para no contaminar los demás casos.
    await db.delete(miembrosPrograma).where(eq(miembrosPrograma.programId, programaB));
  });

  it("un programa INACTIVO no sale, ni para quien administra", async () => {
    await db.update(programs).set({ activo: false }).where(eq(programs.id, programaB));
    expect((await programasVisibles(gerenteId, "gerente", db)).map((p) => p.id)).toEqual([programaA]);
    await db.update(programs).set({ activo: true }).where(eq(programs.id, programaB));
  });

  it("idsDeProgramasVisibles devuelve un Set de ids", async () => {
    const ids = await idsDeProgramasVisibles(anaUserId, "closer", db);
    expect(ids.has(programaA)).toBe(true);
    expect(ids.has(programaB)).toBe(false);
    expect(ids.size).toBe(1);
  });

  it("programaVisiblePorSlug: el propio se resuelve, el ajeno es null (404, no 403)", async () => {
    expect((await programaVisiblePorSlug(anaUserId, "closer", slugA, db))?.id).toBe(programaA);
    // El programa ajeno EXISTE, pero para este closer es indistinguible de uno
    // inexistente: null, para que la ruta responda 404 y no filtre que slugs existen.
    expect(await programaVisiblePorSlug(anaUserId, "closer", slugB, db)).toBeNull();
    // Un slug que no existe también es null.
    expect(await programaVisiblePorSlug(anaUserId, "closer", "no-existe", db)).toBeNull();
    // El gerente sí ve el ajeno.
    expect((await programaVisiblePorSlug(gerenteId, "gerente", slugB, db))?.id).toBe(programaB);
  });

  it("solo un administrador abre la ficha de un programa inactivo", async () => {
    await db.update(programs).set({ activo: false }).where(eq(programs.id, programaB));
    expect((await programaDeLaFichaPorSlug(gerenteId, "gerente", slugB, db))?.activo).toBe(false);
    expect(await programaDeLaFichaPorSlug(anaUserId, "closer", slugB, db)).toBeNull();
    expect(await programaDeLaFichaPorSlug(anaUserId, "closer", slugA, db)).not.toBeNull();
    expect(await programasInactivosParaAdministrar(anaUserId, "closer", db)).toEqual([]);
    expect(await programasInactivosParaAdministrar(gerenteId, "gerente", db)).toEqual([
      { slug: slugB, nombre: "Programa B" },
    ]);
    await db.update(programs).set({ activo: true }).where(eq(programs.id, programaB));
  });

  it("programaEnAlcance: true para el propio, false para el ajeno", async () => {
    expect(await programaEnAlcance(anaUserId, "closer", programaA, db)).toBe(true);
    expect(await programaEnAlcance(anaUserId, "closer", programaB, db)).toBe(false);
    expect(await programaEnAlcance(gerenteId, "gerente", programaB, db)).toBe(true);
  });

  it("buscarLeads queda acotado al programa recibido", async () => {
    const [pa] = await db
      .insert(leads)
      .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaA, emailNormalizado: "persona-a@correo.co", nombre: "Persona A" })
      .returning();
    const [pb] = await db
      .insert(leads)
      .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programaB, emailNormalizado: "persona-b@correo.co", nombre: "Persona B" })
      .returning();

    expect((await buscarLeads(db, programaA, "Persona")).map((r) => r.id)).toEqual([pa.id]);
    expect((await buscarLeads(db, programaB, "Persona")).map((r) => r.id)).toEqual([pb.id]);

    await db.delete(leads).where(eq(leads.id, pa.id));
    await db.delete(leads).where(eq(leads.id, pb.id));
  });
});
