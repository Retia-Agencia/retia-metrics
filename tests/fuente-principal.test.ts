import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  activarFuente,
  crearFuente,
  desactivarFuente,
  editarFuente,
  marcarFuentePrincipal,
  rotarSecretoDeFuente,
} from "@/lib/catalogo/fuentes";
import { destinoDeCaptacion, generarLink } from "@/lib/atribucion/link-de-captacion";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 092 / ADR 0068 — la URL publica vive en la fuente y cada programa tiene a lo sumo
 * una principal, que siempre se puede repartir. Lo que muerde:
 *  - la base: el indice unico parcial y el CHECK, sin pasar por el codigo (ADR 0005);
 *  - el unico escritor de `principal`, con su rastro y el cambio en la misma operacion;
 *  - las rejas: apagar la principal o dejarla sin URL se rechaza con 422 sin tocar la fila;
 *  - el destino del generador: la principal por defecto, otra del programa si se escoge,
 *    nunca una de otro programa, y "sin principal" se dice en vez de dar una URL rota.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let gerenteId: string;
let closerId: string;

const gerente = () => ({ id: gerenteId, rol: "gerente" as const });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  const [c] = await db
    .insert(users)
    .values({ email: "closer@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  closerId = c.id;
  const [a] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "797" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" })
    .returning();
  programaB = b.id;
});

afterEach(async () => {
  await cerrar();
});

/** Una fuente webhook activa, con o sin URL publica. */
async function fuenteActiva(programId: string, nombre: string, urlPublica: string | null) {
  const creada = await crearFuente(db, gerente(), {
    programId,
    nombre,
    tipo: "webhook",
    proveedor: "typeform",
    urlPublica,
  });
  await rotarSecretoDeFuente(db, gerente(), creada.id);
  return activarFuente(db, gerente(), creada.id);
}

async function principalesDe(programId: string) {
  return db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.principal, true)));
}

describe("la base garantiza la principal (ADR 0068 punto 2)", () => {
  it("dos principales en el mismo programa las rechaza el indice", async () => {
    const uno = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    const dos = await fuenteActiva(programaA, "Dapta", "https://dapta.ai/f/dos");
    await db.update(sources).set({ principal: true }).where(eq(sources.id, uno.id));
    await expect(
      db.update(sources).set({ principal: true }).where(eq(sources.id, dos.id)),
    ).rejects.toThrow();
  });

  it("una principal sin URL o inactiva la rechaza el CHECK", async () => {
    const sinUrl = await fuenteActiva(programaA, "Sin URL", null);
    await expect(
      db.update(sources).set({ principal: true }).where(eq(sources.id, sinUrl.id)),
    ).rejects.toThrow();
    const conUrl = await fuenteActiva(programaA, "Con URL", "https://form.typeform.com/to/x");
    await db.update(sources).set({ principal: true }).where(eq(sources.id, conUrl.id));
    await expect(
      db.update(sources).set({ activo: false }).where(eq(sources.id, conUrl.id)),
    ).rejects.toThrow();
  });
});

describe("marcarFuentePrincipal", () => {
  it("cambia la principal en una operacion y deja el rastro de las dos", async () => {
    const uno = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    const dos = await fuenteActiva(programaA, "Dapta", "https://dapta.ai/f/dos");
    await marcarFuentePrincipal(db, gerente(), uno.id);
    const marcada = await marcarFuentePrincipal(db, gerente(), dos.id);

    expect(marcada.principal).toBe(true);
    expect(await principalesDe(programaA)).toEqual([{ id: dos.id }]);
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.tabla, "sources"), eq(changeLog.campo, "principal")));
    expect(rastro.map((r) => [r.registroId, r.valorNuevo]).sort()).toEqual(
      [
        [uno.id, "true"],
        [uno.id, "false"],
        [dos.id, "true"],
      ].sort(),
    );
  });

  it("la principal de un programa no toca la del otro (ADR 0043)", async () => {
    const a = await fuenteActiva(programaA, "A", "https://form.typeform.com/to/a");
    const b = await fuenteActiva(programaB, "B", "https://form.typeform.com/to/b");
    await marcarFuentePrincipal(db, gerente(), a.id);
    await marcarFuentePrincipal(db, gerente(), b.id);
    expect(await principalesDe(programaA)).toEqual([{ id: a.id }]);
    expect(await principalesDe(programaB)).toEqual([{ id: b.id }]);
  });

  it("una fuente sin URL o inactiva no puede ser principal (422)", async () => {
    const sinUrl = await fuenteActiva(programaA, "Sin URL", null);
    await expect(marcarFuentePrincipal(db, gerente(), sinUrl.id)).rejects.toMatchObject({ status: 422 });
    const inactiva = await crearFuente(db, gerente(), {
      programId: programaA,
      nombre: "Inactiva",
      tipo: "webhook",
      proveedor: "typeform",
      urlPublica: "https://form.typeform.com/to/i",
    });
    await expect(marcarFuentePrincipal(db, gerente(), inactiva.id)).rejects.toMatchObject({ status: 422 });
    expect(await principalesDe(programaA)).toEqual([]);
  });

  it("un closer no la marca (403)", async () => {
    const f = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    await expect(
      marcarFuentePrincipal(db, { id: closerId, rol: "closer" }, f.id),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("las rejas de la principal", () => {
  it("desactivar la principal es 422 y la fuente sigue activa", async () => {
    const f = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    await marcarFuentePrincipal(db, gerente(), f.id);
    await expect(desactivarFuente(db, gerente(), f.id)).rejects.toMatchObject({ status: 422 });
    const [enBase] = await db.select().from(sources).where(eq(sources.id, f.id));
    expect(enBase.activo).toBe(true);
  });

  it("quitarle la URL a la principal es 422; editar sin mandar la URL la conserva", async () => {
    const f = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    await marcarFuentePrincipal(db, gerente(), f.id);
    const entrada = { programId: programaA, nombre: "Typeform", tipo: "webhook" as const, proveedor: "typeform" as const };
    await expect(
      editarFuente(db, gerente(), f.id, { ...entrada, urlPublica: "" }),
    ).rejects.toMatchObject({ status: 422 });
    const renombrada = await editarFuente(db, gerente(), f.id, { ...entrada, nombre: "Typeform nuevo" });
    expect(renombrada.urlPublica).toBe("https://form.typeform.com/to/uno");
    expect(renombrada.principal).toBe(true);
  });

  it("una fuente no cambia de programa (ADR 0043): la principal de A no se muda a B", async () => {
    const f = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    await marcarFuentePrincipal(db, gerente(), f.id);
    await expect(
      editarFuente(db, gerente(), f.id, {
        programId: programaB,
        nombre: "Typeform",
        tipo: "webhook",
        proveedor: "typeform",
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await principalesDe(programaA)).toEqual([{ id: f.id }]);
    expect(await principalesDe(programaB)).toEqual([]);
  });

  it("una URL que no es https no entra", async () => {
    await expect(
      crearFuente(db, gerente(), {
        programId: programaA,
        nombre: "Mala",
        tipo: "webhook",
        proveedor: "typeform",
        urlPublica: "http://form.typeform.com/to/x",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("el destino del generador (ADR 0068 puntos 3 y 4)", () => {
  it("sin principal no hay link y lo dice (422), tampoco escogiendo otra fuente", async () => {
    const f = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    await expect(destinoDeCaptacion(db, programaA)).rejects.toMatchObject({ status: 422 });
    await expect(destinoDeCaptacion(db, programaA, f.id)).rejects.toMatchObject({ status: 422 });
  });

  it("por defecto es la principal; se puede escoger otra activa del programa, nunca una ajena", async () => {
    const uno = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/uno");
    const dos = await fuenteActiva(programaA, "Dapta", "https://dapta.ai/f/dos");
    const ajena = await fuenteActiva(programaB, "B", "https://form.typeform.com/to/b");
    await marcarFuentePrincipal(db, gerente(), dos.id);

    expect((await destinoDeCaptacion(db, programaA)).fuenteId).toBe(dos.id);
    expect((await destinoDeCaptacion(db, programaA, uno.id)).url).toBe("https://form.typeform.com/to/uno");
    await expect(destinoDeCaptacion(db, programaA, ajena.id)).rejects.toMatchObject({ status: 404 });
  });

  it("cambiar la URL de la principal cambia el link, sin migrar nada", async () => {
    const f = await fuenteActiva(programaA, "Typeform", "https://form.typeform.com/to/viejo");
    await marcarFuentePrincipal(db, gerente(), f.id);
    const utms = { source: "instagram", medium: "bio", campaign: "lanzamiento" };
    const antes = generarLink((await destinoDeCaptacion(db, programaA)).url, utms);
    await editarFuente(db, gerente(), f.id, {
      programId: programaA,
      nombre: "Typeform",
      tipo: "webhook",
      proveedor: "typeform",
      urlPublica: "https://form.typeform.com/to/nuevo",
    });
    const despues = generarLink((await destinoDeCaptacion(db, programaA)).url, utms);
    expect(antes).toContain("/to/viejo?");
    expect(despues).toContain("/to/nuevo?");
    expect(new URL(despues).search).toBe(new URL(antes).search);
  });
});
