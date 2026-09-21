import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  changeLog,
  miembrosPrograma,
  plataformasPago,
  plataformasPrograma,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  asociarPrograma,
  crearPlataformaConProgramas,
  desasociarPrograma,
  plataformasDelPrograma,
  vinculosDePlataformas,
} from "@/lib/catalogo/plataformas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * ADR 0034 (enmienda del ticket 013): que programas sirve una plataforma vive en una
 * TABLA PUENTE, no en una columna `program_id` —esa obligaria a aflojar el indice
 * unico sobre `lower(nombre)` y PayPal seria dos filas—.
 *
 * Lo que se prueba aca es lo que no se ve hasta que el dinero no cuadra: que el
 * selector de un programa muestre SOLO sus plataformas, que desasociar no toque la
 * plataforma, y que un closer no pueda tocar un programa donde no vende. La barrera
 * es de datos, en el servidor: no alcanza con esconder un boton.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerente: { id: string; rol: "gerente" };
let closer: { id: string; rol: "closer" };
let developer: { id: string; rol: "developer" };
let programaA: string;
let programaB: string;
let plataforma: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente" })
    .returning();
  gerente = { id: g.id, rol: "gerente" };

  const [c] = await db
    .insert(users)
    .values({ email: "closer@retiagrowth.com", rol: "closer", closerId: "Ana" })
    .returning();
  closer = { id: c.id, rol: "closer" };

  const [d] = await db
    .insert(users)
    .values({ email: "dev@retiagrowth.com", rol: "developer", closerId: "Dev" })
    .returning();
  developer = { id: d.id, rol: "developer" };

  const [a] = await db
    .insert(programs)
    .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ slug: "tactical", nombre: "Tactical Investor", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  // PayPal viene sembrada por la migracion; se reusa en vez de insertarla.
  const [pl] = await db.select().from(plataformasPago).where(eq(plataformasPago.nombre, "PayPal"));
  plataforma = pl.id;

  // El closer solo vende en A.
  await db.insert(miembrosPrograma).values({ userId: closer.id, programId: programaA, activo: true });
});

afterEach(async () => {
  await cerrar();
});

const UUID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

async function vinculos() {
  return db.select().from(plataformasPrograma).where(eq(plataformasPrograma.plataformaId, plataforma));
}

async function logDeLaPlataforma() {
  return (await db.select().from(changeLog).where(eq(changeLog.registroId, plataforma))).filter(
    (l) => l.tabla === "plataformas_programa",
  );
}

describe("vinculo plataforma-programa — asociar y desasociar", () => {
  it("asociar crea el vinculo y lo deja en change_log con el nombre del programa", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);

    expect(await vinculos()).toHaveLength(1);
    const log = await logDeLaPlataforma();
    expect(log).toHaveLength(1);
    expect(log[0].campo).toBe("programa");
    expect(log[0].valorAnterior).toBeNull();
    expect(log[0].valorNuevo).toBe("Comunicarte");
    expect(log[0].etiqueta).toBe("PayPal");
    expect(log[0].userId).toBe(gerente.id);
  });

  it("asociar dos veces es idempotente: un vinculo y UNA sola fila de log", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);
    await asociarPrograma(db, gerente, plataforma, programaA);

    expect(await vinculos()).toHaveLength(1);
    expect(await logDeLaPlataforma()).toHaveLength(1);
  });

  it("una plataforma sirve a DOS programas sin duplicarse (ADR 0034)", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);
    await asociarPrograma(db, gerente, plataforma, programaB);

    expect(await vinculos()).toHaveLength(2);
    // La plataforma sigue siendo UNA fila: es el punto de la tabla puente.
    expect(await db.select().from(plataformasPago).where(eq(plataformasPago.id, plataforma))).toHaveLength(1);
  });

  it("desasociar quita el vinculo y NO toca la plataforma", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);
    await desasociarPrograma(db, gerente, plataforma, programaA);

    expect(await vinculos()).toHaveLength(0);

    const [sigueViva] = await db
      .select()
      .from(plataformasPago)
      .where(eq(plataformasPago.id, plataforma));
    expect(sigueViva).toBeDefined();
    expect(sigueViva.activo).toBe(true);

    const log = await logDeLaPlataforma();
    const quitado = log.filter((l) => l.valorNuevo === null);
    expect(quitado).toHaveLength(1);
    expect(quitado[0].valorAnterior).toBe("Comunicarte");
  });

  it("desasociar lo que no esta no es un error y no escribe log", async () => {
    await desasociarPrograma(db, gerente, plataforma, programaA);
    expect(await vinculos()).toHaveLength(0);
    expect(await logDeLaPlataforma()).toHaveLength(0);
  });

  it("un id inexistente es 404, y uno que no es uuid es 400 (nunca un 500 del driver)", async () => {
    const noExiste = await asociarPrograma(db, gerente, plataforma, UUID_INEXISTENTE).catch((e) => e);
    expect(noExiste).toBeInstanceOf(ErrorDeApp);
    expect((noExiste as ErrorDeApp).status).toBe(404);

    const noEsUuid = await asociarPrograma(db, gerente, "no-es-uuid", programaA).catch((e) => e);
    expect(noEsUuid).toBeInstanceOf(ErrorDeApp);
    expect((noEsUuid as ErrorDeApp).status).toBe(400);
  });
});

describe("vinculo plataforma-programa — quien puede tocarlo (ADR 0016, ADR 0025)", () => {
  it("un closer asocia en SU programa", async () => {
    await asociarPrograma(db, closer, plataforma, programaA);
    expect(await vinculos()).toHaveLength(1);
  });

  it("un closer NO asocia en un programa donde no vende, y el vinculo no se crea", async () => {
    const error = await asociarPrograma(db, closer, plataforma, programaB).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
    expect(await vinculos()).toHaveLength(0);
  });

  it("un closer NO desasocia en un programa ajeno, y el vinculo sigue", async () => {
    await asociarPrograma(db, gerente, plataforma, programaB);
    const error = await desasociarPrograma(db, closer, plataforma, programaB).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
    expect(await vinculos()).toHaveLength(1);
  });

  it("el developer entra a cualquier programa sin ser miembro de ninguno (ADR 0025)", async () => {
    await asociarPrograma(db, developer, plataforma, programaA);
    await asociarPrograma(db, developer, plataforma, programaB);
    expect(await vinculos()).toHaveLength(2);
  });
});

describe("vinculo plataforma-programa — lo que ve un selector", () => {
  it("plataformasDelPrograma devuelve SOLO las vinculadas a ese programa", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);

    const enA = await plataformasDelPrograma(db, programaA);
    expect(enA.map((p) => p.id)).toEqual([plataforma]);

    // B no tiene ninguna: una plataforma sin vinculo es invisible, que es el punto.
    expect(await plataformasDelPrograma(db, programaB)).toHaveLength(0);
  });

  it("una plataforma DESACTIVADA no sale aunque siga vinculada", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);
    await db.update(plataformasPago).set({ activo: false }).where(eq(plataformasPago.id, plataforma));

    expect(await plataformasDelPrograma(db, programaA)).toHaveLength(0);
  });

  it("vinculosDePlataformas agrupa por plataforma en una sola consulta", async () => {
    await asociarPrograma(db, gerente, plataforma, programaA);
    await asociarPrograma(db, gerente, plataforma, programaB);

    const mapa = await vinculosDePlataformas(db);
    expect([...(mapa.get(plataforma) ?? [])].sort()).toEqual([programaA, programaB].sort());
  });
});

describe("crear una plataforma y asociarla en la misma operacion (Mani, 20-sep)", () => {
  async function porNombre(nombre: string) {
    return db.select().from(plataformasPago).where(eq(plataformasPago.nombre, nombre));
  }

  it("un administrador crea sin programa: vale, y nace invisible en los selectores", async () => {
    const creada = await crearPlataformaConProgramas(db, gerente, { nombre: "Wise" }, []);
    expect(await porNombre("Wise")).toHaveLength(1);
    expect(await plataformasDelPrograma(db, programaA)).not.toContainEqual(
      expect.objectContaining({ id: creada.id }),
    );
  });

  it("un closer crea y la asocia a SU programa, y la ve en su selector", async () => {
    const creada = await crearPlataformaConProgramas(db, closer, { nombre: "Wise" }, [programaA]);
    const enA = await plataformasDelPrograma(db, programaA);
    expect(enA.map((p) => p.id)).toContain(creada.id);
  });

  it("un closer SIN programa se rechaza (400): nacería invisible para el", async () => {
    const error = await crearPlataformaConProgramas(db, closer, { nombre: "Wise" }, []).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    expect(await porNombre("Wise")).toHaveLength(0);
  });

  it("un closer con un programa AJENO se rechaza (403) y la plataforma NO queda creada", async () => {
    // Lo que se prueba es el ORDEN: el acceso se verifica antes de crear. Al reves,
    // quedaria la plataforma huerfana que esta funcion existe para evitar.
    const error = await crearPlataformaConProgramas(db, closer, { nombre: "Wise" }, [programaB]).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
    expect(await porNombre("Wise")).toHaveLength(0);
  });

  it("un nombre vacio es un 400 legible, no un ZodError que termina en 'Error interno.'", async () => {
    const error = await crearPlataformaConProgramas(db, gerente, { nombre: "   " }, []).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});
