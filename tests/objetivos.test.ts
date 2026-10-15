import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  borrarObjetivo,
  copiarObjetivos,
  crearObjetivo,
  editarObjetivo,
} from "@/lib/catalogo/objetivos";
import { changeLog, cohorts, objetivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  DEFINICION_METRICAS_OBJETIVO,
  METRICAS_OFRECIDAS,
} from "@/lib/objetivos/metricas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let gerente: string;
let programId: string;
let cohortId: string;
const actor = () => ({ id: gerente, rol: "gerente" as const });

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "objetivos-a", nombre: "Objetivos A", ticketUsd: "1000.00" })
    .returning();
  programId = programa.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: "A-1",
    metaCupos: 70,
    precioUsd: "1000.00",
    estado: "futuro",
  }).returning();
  cohortId = cohorte.id;
  const [usuario] = await db.insert(users).values({ email: "objetivos@retia.test", rol: "gerente" }).returning();
  gerente = usuario.id;
}, 60_000);

afterAll(async () => {
  await cerrar();
});

function cupos(area: "paid" | "organico" | "referidos", meta: number) {
  return { cohortId, area, metrica: "cupos" as const, meta, aceptable: null, moneda: null };
}

describe("objetivos de la cohorte", () => {
  it("guarda un reparto 36/24/10 de una meta de 70", async () => {
    await crearObjetivo(db, actor(), cupos("paid", 36));
    await crearObjetivo(db, actor(), cupos("organico", 24));
    await crearObjetivo(db, actor(), cupos("referidos", 10));
    const filas = await db.select().from(objetivos).where(eq(objetivos.cohortId, cohortId));
    expect(filas.map((fila) => Number(fila.meta))).toEqual(expect.arrayContaining([36, 24, 10]));
  });

  it("rechaza 40/40 cuando la meta es 70", async () => {
    await crearObjetivo(db, actor(), cupos("paid", 40));
    await expect(crearObjetivo(db, actor(), cupos("organico", 40))).rejects.toMatchObject({
      message: "Los cupos por área sumarían 80 y la meta de la cohorte es 70.",
      status: 400,
    });
  });

  it("al editar no cuenta la misma fila dos veces", async () => {
    const paid = await crearObjetivo(db, actor(), cupos("paid", 30));
    await crearObjetivo(db, actor(), cupos("organico", 30));
    await expect(editarObjetivo(db, actor(), paid.id, cupos("paid", 40))).resolves.toMatchObject({ meta: 40 });
  });

  it("deriva moneda y área, y rechaza una métrica sin lector sin mover la tabla", async () => {
    const fila = await crearObjetivo(db, actor(), {
      cohortId,
      area: "paid",
      metrica: "costo_por_agenda",
      meta: 20,
      aceptable: 25,
      moneda: "USD",
    });
    expect(fila).toMatchObject({ moneda: "COP", area: null });

    await expect(crearObjetivo(db, actor(), {
      cohortId,
      area: null,
      metrica: "roas",
      meta: 3,
      aceptable: 2,
    })).rejects.toMatchObject({
      message: "Esa métrica todavía no tiene quien la lea.",
      status: 400,
    });
    expect(await db.select().from(objetivos).where(eq(objetivos.cohortId, cohortId))).toHaveLength(1);
  });

  it("guarda como nulo un aceptable vacío", async () => {
    const fila = await crearObjetivo(db, actor(), {
      cohortId,
      area: null,
      metrica: "costo_por_agenda",
      meta: 20,
      aceptable: "",
    });

    expect(fila.aceptable).toBeNull();
    const [guardada] = await db.select().from(objetivos).where(eq(objetivos.id, fila.id));
    expect(guardada.aceptable).toBeNull();
  });

  it("permite quitar y volver a crear el mismo objetivo", async () => {
    const fila = await crearObjetivo(db, actor(), cupos("paid", 20));

    await borrarObjetivo(db, actor(), fila.id);

    await expect(crearObjetivo(db, actor(), cupos("paid", 25))).resolves.toMatchObject({
      area: "paid",
      metrica: "cupos",
      meta: 25,
    });
  });

  it("rechaza el aceptable del lado incorrecto", async () => {
    await expect(crearObjetivo(db, actor(), {
      cohortId,
      area: null,
      metrica: "costo_por_agenda",
      meta: 3,
      aceptable: 2,
    })).rejects.toMatchObject({
      message: "En una métrica de costo, el aceptable debe ser mayor o igual que la meta.",
      status: 400,
    });
  });

  it("rechaza cupos con área total", async () => {
    await expect(crearObjetivo(db, actor(), { ...cupos("paid", 10), area: null })).rejects.toMatchObject({
      message: "Los cupos totales se definen en la meta de la cohorte; elige un área.",
      status: 400,
    });
  });

  it("deja change_log al crear y editar", async () => {
    const fila = await crearObjetivo(db, actor(), cupos("paid", 20));
    await editarObjetivo(db, actor(), fila.id, cupos("paid", 25));
    const cambios = await db.select().from(changeLog).where(eq(changeLog.registroId, fila.id));
    expect(cambios.some((cambio) => cambio.campo === "cohortId")).toBe(true);
    expect(cambios.some((cambio) => cambio.campo === "meta" && cambio.valorAnterior === "20.00")).toBe(true);
  });

  it("rechaza copiar entre programas y copia dentro del mismo programa", async () => {
    await crearObjetivo(db, actor(), cupos("paid", 36));
    const [programaB] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "objetivos-b", nombre: "Objetivos B", ticketUsd: "1000.00" })
      .returning();
    const [ajena] = await db.insert(cohorts).values({
      programId: programaB.id,
      codigo: "B-1",
      metaCupos: 70,
      precioUsd: "1000.00",
      estado: "futuro",
    }).returning();
    await expect(copiarObjetivos(db, actor(), {
      desdeCohorteId: cohortId,
      haciaCohorteId: ajena.id,
    })).rejects.toEqual(expect.objectContaining<Partial<ErrorDeApp>>({ status: 400 }));

    const [destino] = await db.insert(cohorts).values({
      programId,
      codigo: "A-2",
      metaCupos: 70,
      precioUsd: "1000.00",
      estado: "futuro",
    }).returning();
    await copiarObjetivos(db, actor(), { desdeCohorteId: cohortId, haciaCohorteId: destino.id });
    const copiadas = await db.select().from(objetivos).where(eq(objetivos.cohortId, destino.id));
    expect(copiadas).toHaveLength(1);
    expect(Number(copiadas[0].meta)).toBe(36);
  });
});

describe("definición de métricas ofrecidas", () => {
  it("solo ofrece métricas completas y costo por agenda es el único costo ofrecido", () => {
    for (const metrica of METRICAS_OFRECIDAS) {
      expect(DEFINICION_METRICAS_OBJETIVO[metrica]).toMatchObject({
        lector: expect.any(String),
        unidad: expect.any(String),
        sentido: expect.any(String),
      });
    }
    expect(METRICAS_OFRECIDAS.filter(
      (metrica) => DEFINICION_METRICAS_OBJETIVO[metrica].unidad === "COP",
    )).toEqual(["costo_por_agenda"]);
  });
});
