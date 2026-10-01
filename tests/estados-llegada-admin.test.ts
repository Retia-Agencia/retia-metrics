import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { estadosLlegada, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { estadosDeLlegadaParaAdmin } from "@/lib/queries/estados-llegada";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Lo que pinta "Estados de llegada" en `/ajustes/fuentes` (117). Un valor que el formulario
 * mandó y no tiene fila ACTIVA sale en "sin fila"; si la fila existe inactiva, la pantalla
 * ofrece reactivarla y no crearla, porque crearla choca con el índice único (recorrido del
 * 1-oct: "Crear Estado" sobre un valor desactivado terminaba en "ya tiene ese Estado").
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  otroId = q.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  const [g] = await db.insert(sources).values({ programId: otroId, nombre: "Typeform" }).returning();
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "a@c.co" }).returning();
  const [m] = await db.insert(leads).values({ programId: otroId, emailNormalizado: "a@c.co" }).returning();
  await db.insert(submissions).values([
    { leadId: l.id, sourceId: f.id, token: "t1", esParcial: false, calificacion: "descartado" },
    // Otra redacción del mismo valor: misma llave del índice (lower(trim())).
    { leadId: l.id, sourceId: f.id, token: "t2", esParcial: false, calificacion: " Descartado " },
    { leadId: l.id, sourceId: f.id, token: "t3", esParcial: false, calificacion: "nuevo" },
    { leadId: m.id, sourceId: g.id, token: "t4", esParcial: false, calificacion: "descartado" },
  ]);
  await db.insert(estadosLlegada).values([
    { programId, valor: "descartado", etapaEntrada: "pendiente_setteo", prioridad: "normal", activo: false },
  ]);
});

afterEach(async () => {
  await cerrar();
});

const delPrograma = async (id: string) =>
  (await estadosDeLlegadaParaAdmin(db)).sinFila.filter((v) => v.programId === id);

describe("estadosDeLlegadaParaAdmin: valores sin fila", () => {
  it("un valor con fila inactiva trae su id para reactivarla, con las dos redacciones sumadas", async () => {
    const [fila] = await db.select().from(estadosLlegada).where(eq(estadosLlegada.programId, programId));
    const descartado = (await delPrograma(programId)).find((v) => v.valor.toLowerCase() === "descartado");
    expect(descartado).toMatchObject({ envios: 2, inactivoId: fila.id });
  });

  it("un valor que nunca tuvo fila no trae id: se crea", async () => {
    const nuevo = (await delPrograma(programId)).find((v) => v.valor === "nuevo");
    expect(nuevo).toMatchObject({ envios: 1, inactivoId: null });
  });

  it("la fila inactiva de un programa no se ofrece en otro", async () => {
    const enOtro = (await delPrograma(otroId)).find((v) => v.valor === "descartado");
    expect(enOtro).toMatchObject({ envios: 1, inactivoId: null });
  });

  it("reactivada, el valor deja de salir como sin fila", async () => {
    await db.update(estadosLlegada).set({ activo: true }).where(eq(estadosLlegada.programId, programId));
    expect((await delPrograma(programId)).map((v) => v.valor)).toEqual(["nuevo"]);
  });
});
