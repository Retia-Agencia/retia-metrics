import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { changeLog, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { rellenarComisionDeVentas } from "@/lib/deals/rellenar-comision";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("rellenar comisión de ventas", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let actorId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [actor] = await db.insert(users).values({ email: "actor@retia.co", rol: "developer" }).returning();
    actorId = actor.id;
  });

  afterAll(async () => cerrar());

  async function sembrar() {
    const [conPorcentaje] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "con-porcentaje",
      nombre: "Con porcentaje",
      ticketUsd: "1000",
      comisionPorcentaje: "12.50",
    }).returning();
    const [sinPorcentaje] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "sin-porcentaje",
      nombre: "Sin porcentaje",
      ticketUsd: "1000",
      comisionPorcentaje: null,
    }).returning();
    const personas = await db.insert(leads).values([
      { programId: conPorcentaje.id, emailNormalizado: "uno@retia.co" },
      { programId: conPorcentaje.id, emailNormalizado: "dos@retia.co" },
      { programId: conPorcentaje.id, emailNormalizado: "anulado@retia.co" },
      { programId: conPorcentaje.id, emailNormalizado: "abierto@retia.co" },
      { programId: sinPorcentaje.id, emailNormalizado: "sin-pct@retia.co" },
    ]).returning();
    const filas = await db.insert(deals).values([
      { programId: conPorcentaje.id, leadId: personas[0].id, etapa: "ganado_parcial", comisionPorcentaje: null },
      { programId: conPorcentaje.id, leadId: personas[1].id, etapa: "ganado_completo", comisionPorcentaje: null },
      {
        programId: conPorcentaje.id,
        leadId: personas[2].id,
        etapa: "ganado_completo",
        comisionPorcentaje: null,
        anuladoEn: new Date("2026-10-30T10:00:00-05:00"),
        anuladoPor: actorId,
        motivoAnulacion: "duplicado",
      },
      { programId: conPorcentaje.id, leadId: personas[3].id, etapa: "atendido", comisionPorcentaje: null },
      { programId: sinPorcentaje.id, leadId: personas[4].id, etapa: "ganado_parcial", comisionPorcentaje: null },
    ]).returning();
    return { filas };
  }

  it("en seco informa sin escribir", async () => {
    const { filas } = await sembrar();

    const resultado = await rellenarComisionDeVentas(db, { aplicar: false, actorId });

    expect(resultado).toEqual(expect.arrayContaining([
      { programa: "Con porcentaje", porcentaje: "12.50", ventasSinPorcentaje: 2, rellenables: 2 },
      { programa: "Sin porcentaje", porcentaje: null, ventasSinPorcentaje: 1, rellenables: 0 },
    ]));
    const guardados = await db.select().from(deals).where(inArray(deals.id, filas.map((fila) => fila.id)));
    expect(guardados.every((fila) => fila.comisionPorcentaje === null)).toBe(true);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("aplica solo a ventas vigentes con porcentaje y deja un rastro por deal", async () => {
    const { filas } = await sembrar();

    await rellenarComisionDeVentas(db, { aplicar: true, actorId });

    const guardados = new Map((await db.select().from(deals)).map((fila) => [fila.id, fila]));
    expect(guardados.get(filas[0].id)?.comisionPorcentaje).toBe("12.50");
    expect(guardados.get(filas[1].id)?.comisionPorcentaje).toBe("12.50");
    expect(guardados.get(filas[2].id)?.comisionPorcentaje).toBeNull();
    expect(guardados.get(filas[3].id)?.comisionPorcentaje).toBeNull();
    expect(guardados.get(filas[4].id)?.comisionPorcentaje).toBeNull();
    const rastros = await db.select().from(changeLog).where(eq(changeLog.campo, "comisionPorcentaje"));
    expect(rastros).toHaveLength(2);
    expect(rastros.every((fila) => fila.tabla === "deals" && fila.userId === actorId)).toBe(true);

    const segunda = await rellenarComisionDeVentas(db, { aplicar: true, actorId });
    expect(segunda.reduce((total, fila) => total + fila.rellenables, 0)).toBe(0);
    expect(await db.select().from(changeLog).where(eq(changeLog.campo, "comisionPorcentaje"))).toHaveLength(2);
  });
});
