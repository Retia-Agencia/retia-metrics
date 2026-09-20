import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { categoriasRecurso, changeLog, programs, recursos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearRecurso,
  desactivarRecurso,
  esquemaRecurso,
  reactivarRecurso,
  reemplazarRecurso,
} from "@/lib/catalogo/recursos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 022 — recursos como links (ADR 0017, ADR 0012).
 *
 * Un recurso es una instancia del molde con dos cosas propias:
 *  - `vigente` + `reemplazaA`: la operacion `reemplazar` crea una fila nueva
 *    vigente y baja la anterior, sin borrarla (el historial es el punto).
 *  - `programId` nulo = recurso global (sirve para todos los programas).
 *
 * La URL solo puede ser https:// (ADR 0017). Base PGlite nueva por test.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;
let programaA: string;
let catBrochure: string;
let catGuion: string;

/** El actor gerente (id + rol). Los recursos ahora reciben `{ id, rol }` (ADR 0016). */
let actorGerente: { id: string; rol: "gerente" };

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  gerenteId = crypto.randomUUID();

  const [u] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = u.id;
  actorGerente = { id: gerenteId, rol: "gerente" };

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [b] = await db.insert(categoriasRecurso).values({ nombre: "Brochure" }).returning();
  catBrochure = b.id;
  const [g] = await db.insert(categoriasRecurso).values({ nombre: "Guion" }).returning();
  catGuion = g.id;
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

const recursoValido = (over: Partial<Record<string, unknown>> = {}) => ({
  programId: programaA,
  categoriaId: catBrochure,
  titulo: "Brochure Comunicarte",
  url: "https://drive.google.com/brochure",
  ...over,
});

// ─────────────────────────────────────────────────────────── esquema

describe("esquema de recurso", () => {
  it("acepta un recurso valido con https", () => {
    const datos = esquemaRecurso.parse(recursoValido());
    expect(datos.url).toBe("https://drive.google.com/brochure");
  });

  it("acepta programId nulo (recurso global)", () => {
    const datos = esquemaRecurso.parse(recursoValido({ programId: null }));
    expect(datos.programId).toBeNull();
  });

  it("rechaza una URL http:// con mensaje claro", () => {
    const parsed = esquemaRecurso.safeParse(recursoValido({ url: "http://drive.google.com/x" }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message.length).toBeGreaterThan(0);
    }
  });

  it("rechaza una URL que no es url", () => {
    expect(esquemaRecurso.safeParse(recursoValido({ url: "no-es-url" })).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────── crear

describe("crear recurso", () => {
  it("crea un recurso vigente y lo deja en change_log", async () => {
    const creado = await crearRecurso(db, actorGerente, recursoValido());
    expect(creado.vigente).toBe(true);
    expect(creado.activo).toBe(true);
    expect(creado.reemplazaA).toBeNull();

    const log = await logDe(creado.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === gerenteId)).toBe(true);
    expect(log[0].tabla).toBe("recursos");
  });

  it("una URL http:// al crear es un 400, no un 500", async () => {
    const error = await crearRecurso(db, actorGerente, recursoValido({ url: "http://x.com/y" })).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("dos recursos globales (programId nulo) vigentes con mismo titulo y categoria chocan con 400", async () => {
    await crearRecurso(db, actorGerente, recursoValido({ programId: null, titulo: "Guia" }));
    const error = await crearRecurso(
      db,
      actorGerente,
      recursoValido({ programId: null, titulo: "guia" }),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    // El indice parcial con coalesce lo atrapa: no debe salir como 500.
    expect((error as ErrorDeApp).status).not.toBe(500);
    expect([400, 409]).toContain((error as ErrorDeApp).status);
  });
});

// ─────────────────────────────────────────────────────────── reemplazar

describe("reemplazar recurso", () => {
  it("reemplazar deja UNA sola version vigente y encadena el historial", async () => {
    const v1 = await crearRecurso(db, actorGerente, recursoValido());
    const v2 = await reemplazarRecurso(db, actorGerente, v1.id, "https://drive.google.com/v2");
    const v3 = await reemplazarRecurso(db, actorGerente, v2.id, "https://drive.google.com/v3");

    // Exactamente una fila vigente para (programa, categoria, titulo).
    const vigentes = await db
      .select()
      .from(recursos)
      .where(
        and(
          eq(recursos.programId, programaA),
          eq(recursos.categoriaId, catBrochure),
          eq(recursos.vigente, true),
        ),
      );
    expect(vigentes.length).toBe(1);
    expect(vigentes[0].id).toBe(v3.id);
    expect(vigentes[0].url).toBe("https://drive.google.com/v3");

    // Cadena de reemplazaA: v3 -> v2 -> v1 -> null.
    expect(v3.reemplazaA).toBe(v2.id);
    expect(v2.reemplazaA).toBe(v1.id);

    // Las viejas siguen ahi, no vigentes y NO borradas.
    const todas = await db
      .select()
      .from(recursos)
      .where(eq(recursos.categoriaId, catBrochure));
    expect(todas.length).toBe(3);
    const v1f = todas.find((r) => r.id === v1.id)!;
    const v2f = todas.find((r) => r.id === v2.id)!;
    expect(v1f.vigente).toBe(false);
    expect(v2f.vigente).toBe(false);
    expect(v1f.activo).toBe(true);
  });

  it("cada paso mantiene exactamente una vigente (nunca 23505 al insertar la nueva)", async () => {
    const v1 = await crearRecurso(db, actorGerente, recursoValido());
    const cuenta = async () =>
      (
        await db
          .select()
          .from(recursos)
          .where(
            and(
              eq(recursos.programId, programaA),
              eq(recursos.categoriaId, catBrochure),
              eq(recursos.vigente, true),
            ),
          )
      ).length;
    expect(await cuenta()).toBe(1);
    await reemplazarRecurso(db, actorGerente, v1.id, "https://drive.google.com/v2");
    expect(await cuenta()).toBe(1);
  });

  it("reemplazar deja rastro en change_log de la url nueva", async () => {
    const v1 = await crearRecurso(db, actorGerente, recursoValido());
    const v2 = await reemplazarRecurso(db, actorGerente, v1.id, "https://drive.google.com/v2");
    const log = await logDe(v2.id);
    expect(log.some((l) => l.campo === "url" && l.valorNuevo === "https://drive.google.com/v2")).toBe(
      true,
    );
    expect(log.every((l) => l.userId === gerenteId)).toBe(true);
  });

  it("una URL http:// al reemplazar es un 400", async () => {
    const v1 = await crearRecurso(db, actorGerente, recursoValido());
    const error = await reemplazarRecurso(db, actorGerente, v1.id, "http://x.com/y").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("reemplazar un id inexistente es un 404", async () => {
    const error = await reemplazarRecurso(
      db,
      actorGerente,
      crypto.randomUUID(),
      "https://x.com/y",
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });

  it("un id que no es uuid al reemplazar es un 400", async () => {
    const error = await reemplazarRecurso(db, actorGerente, "no-uuid", "https://x.com/y").catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────── desactivar / reactivar

describe("desactivar y reactivar recurso (nunca DELETE)", () => {
  it("desactivar no borra la fila y queda en change_log", async () => {
    const creado = await crearRecurso(db, actorGerente, recursoValido());
    await desactivarRecurso(db, actorGerente, creado.id);

    const [fila] = await db.select().from(recursos).where(eq(recursos.id, creado.id));
    expect(fila).toBeDefined();
    expect(fila.activo).toBe(false);

    const log = await logDe(creado.id);
    expect(log.some((l) => l.campo === "activo" && l.valorNuevo === "false")).toBe(true);
  });

  it("reactivar vuelve a dejar el recurso activo", async () => {
    const creado = await crearRecurso(db, actorGerente, recursoValido());
    await desactivarRecurso(db, actorGerente, creado.id);
    const react = await reactivarRecurso(db, actorGerente, creado.id);
    expect(react.activo).toBe(true);
  });

  it("un recurso global desactivado libera el cupo del indice para uno nuevo", async () => {
    const g1 = await crearRecurso(
      db,
      actorGerente,
      recursoValido({ programId: null, titulo: "Global" }),
    );
    await desactivarRecurso(db, actorGerente, g1.id);
    // Ahora crear otro global con el mismo titulo NO choca (el anterior no es activo).
    const g2 = await crearRecurso(
      db,
      actorGerente,
      recursoValido({ programId: null, titulo: "Global" }),
    );
    expect(g2.id).not.toBe(g1.id);
    const globalesVigentes = await db
      .select()
      .from(recursos)
      .where(and(isNull(recursos.programId), eq(recursos.vigente, true), eq(recursos.activo, true)));
    expect(globalesVigentes.filter((r) => r.categoriaId === catBrochure).length).toBe(1);
    // silence unused
    void catGuion;
  });
});
