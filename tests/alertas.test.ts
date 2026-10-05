import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { guardarUmbral, umbralesDelPrograma } from "@/lib/catalogo/umbrales";
import { alertasDelPrograma, cumplimientoAlCierre, evaluarAlerta, habilesCerradosAntesDe, type DatosDeAlertas } from "@/lib/queries/alertas";
import { vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 147: alertas por persistencia. Una métrica del semáforo de la meta caída N días hábiles
 * CERRADOS seguidos bajo su aceptable dispara; un día no. Los umbrales son filas por programa.
 */

// Cohorte de 22 cupos que vende del jueves 1-oct al viernes 30-oct de 2026: 22 hábiles, 1 cupo por hábil.
const cohorte = {
  id: "c1", codigo: "C1", metaCupos: 22, precioUsd: 100, fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-10-30",
};
const datos = (ventas: DatosDeAlertas["ventas"]): DatosDeAlertas => ({
  cohortes: [cohorte],
  ventas,
  ventasDeLaCohorte: ventas.map(({ dealId, dia }) => ({ dealId, dia })),
  cohorteActivaId: "c1",
});
const venta = (dia: string, n: number) => ({ dealId: `${dia}-${n}`, cohortId: "c1", dia });

describe("la cuenta de las alertas", () => {
  it("solo mira días hábiles cerrados: hoy no cuenta y el fin de semana se salta", () => {
    // El lunes 12-oct: el último cerrado es el viernes 9.
    expect(habilesCerradosAntesDe("2026-10-12", 3)).toEqual(["2026-10-09", "2026-10-08", "2026-10-07"]);
  });

  it("el cumplimiento al cierre de un día usa lo vendido HASTA ese día", () => {
    // Ritmo 1 cupo por hábil; al cierre del 5-oct (3er hábil) se esperaban 3.
    const d = datos([venta("2026-10-01", 1), venta("2026-10-02", 1), venta("2026-10-09", 1)]);
    expect(cumplimientoAlCierre("meta_cohorte", d, "2026-10-05")).toBeCloseTo(2 / 3);
    expect(cumplimientoAlCierre("meta_mes", d, "2026-10-05")).toBeCloseTo(2 / 3);
  });

  it("sin ventas, cinco días hábiles bajo el aceptable disparan; cuatro no", () => {
    const sinVentas = datos([]);
    const umbral = { metrica: "meta_cohorte" as const, aceptable: 80, diasSeguidos: 5 };
    // Lunes 12-oct: cerrados 1, 2, 5, 6, 7, 8 y 9 de octubre (7 hábiles) bajo; antes, sin ventana.
    const al12 = evaluarAlerta(umbral, sinVentas, "2026-10-12");
    expect(al12.racha).toBe(7);
    expect(al12.disparada).toBe(true);
    expect(al12.dias.map((d) => d.dia)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    // El jueves 8-oct: los cerrados 1, 2, 5, 6 y 7 son exactamente cinco → dispara.
    expect(evaluarAlerta(umbral, sinVentas, "2026-10-08").disparada).toBe(true);
    // El miércoles 7-oct: solo 4 cerrados dentro de la ventana; el 30-sep no tenía esperado y corta.
    const al7 = evaluarAlerta(umbral, sinVentas, "2026-10-07");
    expect(al7.racha).toBe(4);
    expect(al7.disparada).toBe(false);
  });

  it("un día en ruta corta la racha", () => {
    // Al cierre del 8-oct se esperaban 6 y hay 6: 100 %. Después nada más.
    const d = datos([1, 2, 3, 4, 5, 6].map((n) => venta("2026-10-08", n)));
    const alerta = evaluarAlerta({ metrica: "meta_cohorte", aceptable: 80, diasSeguidos: 2 }, d, "2026-10-13");
    // 9-oct: 6/7 = 85,7 % (no bajo) → racha 1 desde el 12-oct (6/8 = 75 %).
    expect(alerta.racha).toBe(1);
    expect(alerta.disparada).toBe(false);
  });
});

describe("los umbrales y las alertas del programa", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programaA: string;
  let programaB: string;
  let gerente: string;
  let closer: string;

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    [programaA, programaB] = (await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "a147", nombre: "A" },
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "b147", nombre: "B" },
    ]).returning()).map((p) => p.id);
    [gerente, closer] = (await db.insert(users).values([
      { email: "g@a147.test", rol: "gerente" },
      { email: "c@a147.test", rol: "closer", closerId: "Caro" },
    ]).returning()).map((u) => u.id);
    const [c] = await db.insert(cohorts).values({
      programId: programaA, codigo: "C1", metaCupos: 22, precioUsd: "100", fechaInicioClases: "2026-11-02",
      fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-10-30", estado: "activo",
    }).returning();
    // Una sola venta, el 1-oct: después todo queda bajo el 80 %.
    const [lead] = await db.insert(leads).values({ programId: programaA, emailNormalizado: "l@a147.test" }).returning();
    const [deal] = await db.insert(deals).values({ programId: programaA, leadId: lead.id, ownerUserId: closer, etapa: "ganado_completo", cohortId: c.id }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date("2026-10-01T15:00:00-05:00") });
  }, 120_000);
  afterAll(async () => cerrar());

  it("guardar crea y edita por el molde, con rastro en change_log", async () => {
    const creado = await guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_cohorte", aceptable: "80", diasSeguidos: "5", activo: true });
    expect(creado).toMatchObject({ metrica: "meta_cohorte", aceptable: 80, diasSeguidos: 5, activo: true });
    const editado = await guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_cohorte", aceptable: 70, diasSeguidos: 3, activo: true });
    expect(editado.id).toBe(creado.id);
    expect(editado).toMatchObject({ aceptable: 70, diasSeguidos: 3 });
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "umbrales_alerta"), eq(changeLog.registroId, creado.id)));
    expect(rastro.some((r) => r.campo === "aceptable" && r.valorNuevo === "70.00")).toBe(true);
    expect(rastro.every((r) => r.userId === gerente)).toBe(true);
  });

  it("un closer no cambia umbrales, y el aceptable y los días se validan", async () => {
    await expect(guardarUmbral(db, { id: closer, rol: "closer" }, { programId: programaA, metrica: "meta_mes", aceptable: 80, diasSeguidos: 5, activo: true }))
      .rejects.toMatchObject({ status: 403 });
    await expect(guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_mes", aceptable: 0, diasSeguidos: 5, activo: true })).rejects.toThrow();
    await expect(guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_mes", aceptable: 80, diasSeguidos: 31, activo: true })).rejects.toThrow();
    expect((await umbralesDelPrograma(db, programaA)).map((u) => u.metrica)).toEqual(["meta_cohorte"]);
  });

  it("la alerta sale del programa con umbral, y otro programa no tiene ninguna", async () => {
    const [alerta] = await alertasDelPrograma(programaA, "2026-10-12", db);
    expect(alerta).toMatchObject({ metrica: "meta_cohorte", aceptable: 70, diasSeguidos: 3, disparada: true });
    expect(await alertasDelPrograma(programaB, "2026-10-12", db)).toEqual([]);
  });

  it("la meta de la cohorte cuadra con la del Pulso, también con una venta que se perdió", async () => {
    // Un segundo deal vendido el 2-oct que después pasó a Cierre Perdido: el Pulso ya no lo cuenta.
    const [c] = await db.select().from(cohorts).where(eq(cohorts.programId, programaA));
    const [lead] = await db.insert(leads).values({ programId: programaA, emailNormalizado: "perdido@a147.test" }).returning();
    const [deal] = await db.insert(deals).values({ programId: programaA, leadId: lead.id, ownerUserId: closer, etapa: "cierre_perdido", cohortId: c.id }).returning();
    await db.insert(dealEtapaHistorial).values([
      { dealId: deal.id, a: "ganado_parcial", fecha: new Date("2026-10-02T10:00:00-05:00") },
      { dealId: deal.id, de: "ganado_parcial", a: "cierre_perdido", fecha: new Date("2026-10-05T10:00:00-05:00") },
    ]);
    await guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_cohorte", aceptable: 70, diasSeguidos: 3, activo: true });
    // El día 9-oct cerrado es el último que mira la alerta del 12-oct; el Pulso de ese día es la referencia.
    const [alerta] = await alertasDelPrograma(programaA, "2026-10-12", db);
    const pulso = await vistaDeCohorteActiva({ programId: programaA, claveCloser: null }, "2026-10-09", db);
    expect(alerta.dias.at(-1)).toEqual({ dia: "2026-10-09", cumplimiento: pulso!.ventana!.cumplimiento });
  });

  it("un umbral desactivado no alerta y se reactiva guardando", async () => {
    await guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_cohorte", aceptable: 70, diasSeguidos: 3, activo: false });
    expect(await alertasDelPrograma(programaA, "2026-10-12", db)).toEqual([]);
    await guardarUmbral(db, { id: gerente, rol: "gerente" }, { programId: programaA, metrica: "meta_cohorte", aceptable: 70, diasSeguidos: 3, activo: true });
    expect(await alertasDelPrograma(programaA, "2026-10-12", db)).toHaveLength(1);
  });
});
