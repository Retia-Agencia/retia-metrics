import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resolverPeriodo } from "@/lib/periodo";
import { acumularPorHabil, serieDealsContraAgendas } from "@/lib/queries/deals-contra-agendas";
import { listaDeMetrica, resumenDeMetrica } from "@/lib/queries/metricas-con-filas";
import { periodoDeLaGrafica, vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

// Octubre de 2026 empieza en jueves: el viernes 9 es su hábil 7. Septiembre empieza en martes,
// así que sus 7 primeros hábiles terminan el miércoles 9.
const HOY = "2026-10-09";
const A = { desde: "2026-10-01", hasta: "2026-10-09" };
const B = { desde: "2026-09-01", hasta: "2026-09-09" };
const bogota = (dia: string, hora = "12:00") => new Date(`${dia}T${hora}:00-05:00`);

describe("138: acumular por día hábil (puro)", () => {
  it("lo que nace un fin de semana entra en el hábil siguiente, y lo que cae después del último hábil, en el último", () => {
    const puntos = acumularPorHabil({ desde: "2026-10-03", hasta: "2026-10-11" }, [
      { dia: "2026-10-03", deals: 2, agendas: 1 }, // sábado, antes del primer hábil
      { dia: "2026-10-07", deals: 1, agendas: 0 },
      { dia: "2026-10-11", deals: 0, agendas: 3 }, // domingo, después del último hábil
      { dia: "2026-10-12", deals: 9, agendas: 9 }, // fuera del rango
    ]);
    expect(puntos.map((p) => p.dia)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(puntos.map((p) => [p.habil, p.deals, p.agendas])).toEqual([
      [1, 2, 1], [2, 2, 1], [3, 3, 1], [4, 3, 1], [5, 3, 4],
    ]);
    expect(puntos.at(-1)!.razon).toBe(4 / 3);
  });

  it("sin deals no hay razón, y un rango sin hábiles no tiene puntos", () => {
    expect(acumularPorHabil({ desde: "2026-10-05", hasta: "2026-10-05" }, [{ dia: "2026-10-05", deals: 0, agendas: 2 }])[0].razon)
      .toBeNull();
    expect(acumularPorHabil({ desde: "2026-10-03", hasta: "2026-10-04" }, [{ dia: "2026-10-03", deals: 1, agendas: 1 }]))
      .toEqual([]);
  });

  it("el día hábil 7 compara contra los 7 primeros hábiles del mes anterior, no contra el mes", () => {
    const { periodo } = periodoDeLaGrafica(resolverPeriodo({ preset: "este_mes" }, { hoy: HOY }), HOY);
    expect(periodo.a).toEqual(A);
    expect(periodo.b).toEqual(B);
  });

  it("si el mes apenas empieza, la gráfica pasa al mes pasado completo, también un 1 en domingo", () => {
    for (const hoy of ["2026-10-01", "2026-11-01"]) {
      const { periodo, nota } = periodoDeLaGrafica(resolverPeriodo({ preset: "hoy" }, { hoy }), hoy);
      expect(periodo.a.desde.slice(8)).toBe("01");
      expect(periodo.a.hasta < hoy).toBe(true);
      expect(nota).toMatch(/mes pasado/);
    }
  });

  it("si el selector es un solo día, la gráfica pasa a este mes contra el anterior y lo dice", () => {
    const { periodo, nota } = periodoDeLaGrafica(resolverPeriodo({ preset: "hoy" }, { hoy: HOY }), HOY);
    expect(periodo.a).toEqual(A);
    expect(periodo.b).toEqual(B);
    expect(nota).toMatch(/este mes/);
    expect(periodoDeLaGrafica(resolverPeriodo({ preset: "esta_semana" }, { hoy: HOY }), HOY).nota).toBeUndefined();
  });
});

describe("138: deals creados contra agendas, contra la base", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programaA: string;
  let programaB: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    [programaA, programaB] = (await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-a", nombre: "A" },
      { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "prueba-b", nombre: "B" },
    ]).returning()).map((p) => p.id);
    const [owner] = await db.insert(users).values({ email: "ana@example.test", rol: "closer", closerId: "Ana" }).returning();
    const [fuente] = await db.insert(sources).values({ programId: programaA, nombre: "Formulario" }).returning();

    let n = 0;
    const deal = async (clave: string, programId: string, creado: Date, extra: Partial<typeof deals.$inferInsert> = {}) => {
      n += 1;
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `p${n}@example.test` }).returning();
      const [fila] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: owner.id, createdAt: creado, ...extra }).returning();
      ids[clave] = fila.id;
      return { lead, fila };
    };

    // GC-07: el deal nace el día de su envío de origen, no el día en que se escribió la fila.
    const conEnvio = await deal("conEnvio", programaA, bogota("2026-10-05"));
    const [envio] = await db.insert(submissions).values({
      leadId: conEnvio.lead.id, sourceId: fuente.id, token: "t-1", esParcial: false, fechaEnvio: bogota("2026-10-01", "10:00"),
    }).returning();
    await db.update(deals).set({ submissionOrigenId: envio.id }).where(eq(deals.id, conEnvio.fila.id));

    await deal("sabado", programaA, bogota("2026-10-03")); // entra en el hábil del lunes 5
    await deal("anulado", programaA, bogota("2026-10-02"), {
      anuladoEn: bogota("2026-10-02"), anuladoPor: owner.id, motivoAnulacion: "Prueba",
    });
    // 23:30 en Bogotá ya es el 10 en UTC: cuenta el 9.
    await deal("nocheDel9", programaA, bogota("2026-10-09", "23:30"));
    await deal("otroPrograma", programaB, bogota("2026-10-02"));
    await deal("deSeptiembre", programaA, bogota("2026-09-02"));
    await deal("fueraDeB", programaA, bogota("2026-09-10"));

    // La agenda cuenta el día en que se agendó (su alta), no el de la cita.
    await db.insert(calls).values([
      { programId: programaA, dealId: ids.conEnvio, origen: "calendly", createdAt: bogota("2026-10-01"), fechaAgenda: bogota("2026-10-20") },
      { programId: programaA, dealId: null, origen: "calendly", createdAt: bogota("2026-10-04"), fechaAgenda: bogota("2026-10-06") },
      {
        programId: programaA, dealId: ids.sabado, origen: "calendly", createdAt: bogota("2026-10-02"),
        anuladoEn: bogota("2026-10-02"), anuladoPor: owner.id, motivoAnulacion: "Prueba",
      },
      { programId: programaA, dealId: ids.deSeptiembre, origen: "calendly", createdAt: bogota("2026-09-03") },
      { programId: programaB, dealId: ids.otroPrograma, origen: "calendly", createdAt: bogota("2026-10-02") },
    ]);
  }, 60_000);

  afterAll(async () => cerrar());

  it("acumula A y B al mismo hábil, con la fecha del envío, sin anulados ni otro programa", async () => {
    const a = await serieDealsContraAgendas(db, { programId: programaA, rango: A });
    const b = await serieDealsContraAgendas(db, { programId: programaA, rango: B });
    expect(a.puntos.map((p) => [p.deals, p.agendas])).toEqual([
      [1, 1], [1, 1], [2, 2], [2, 2], [2, 2], [2, 2], [3, 2],
    ]);
    expect(b.puntos.map((p) => [p.deals, p.agendas])).toEqual([
      [0, 0], [1, 0], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1],
    ]);
    expect(b.puntos[0].razon).toBeNull();
    expect(a.puntos.at(-1)!.razon).toBe(2 / 3);
  });

  it("la razón es de cada programa: la de B no se mezcla con la de A", async () => {
    const otro = await serieDealsContraAgendas(db, { programId: programaB, rango: A });
    expect(otro.programId).toBe(programaB);
    expect(otro.puntos.at(-1)).toMatchObject({ deals: 1, agendas: 1, razon: 1 });
  });

  it.each([
    ["deals_creados", "deals"],
    ["agendas_creadas", "agendas"],
  ] as const)("%s: el último punto cuadra con el resumen y con todas las filas de la lista", async (metrica, campo) => {
    const serie = await serieDealsContraAgendas(db, { programId: programaA, rango: A });
    const [resumen] = await resumenDeMetrica(metrica, { programId: programaA, rango: A, hoy: HOY }, db);
    const [lista] = await listaDeMetrica(metrica, { programId: programaA, rango: A, hoy: HOY }, 1, db);
    expect(resumen.subtotal.cantidad).toBe(serie.puntos.at(-1)![campo]);
    expect(lista.filas).toHaveLength(serie.puntos.at(-1)![campo]);
    if (metrica === "deals_creados") {
      expect(new Set(lista.filas.map((f) => f.id))).toEqual(new Set([ids.conEnvio, ids.sabado, ids.nocheDel9]));
      expect(lista.filas.find((f) => f.id === ids.conEnvio)!.fecha).toBe("2026-10-01");
    } else {
      expect(lista.filas.some((f) => f.dealId === null)).toBe(true);
    }
  });

  it("con closer no hay cifra ni gráfica: nunca el programa entero", async () => {
    const [resumen] = await resumenDeMetrica("deals_creados", { programId: programaA, rango: A, hoy: HOY, closerId: "Ana" }, db);
    expect(resumen).toMatchObject({ disponible: false, subtotal: { cantidad: 0 } });
    const periodo = resolverPeriodo({ preset: "este_mes" }, { hoy: HOY });
    expect(await vistaDealsContraAgendas({ programId: programaA, slug: "prueba-a", hoy: HOY, periodo, closerId: "Ana" }, db))
      .toEqual({ disponible: false });
  });

  it("la vista arma A, B y el enlace de cada cifra a su lista con el periodo de la gráfica", async () => {
    const periodo = resolverPeriodo({ preset: "hoy" }, { hoy: HOY });
    const vista = await vistaDealsContraAgendas({ programId: programaA, slug: "prueba-a", hoy: HOY, periodo, closerId: null }, db);
    if (!vista.disponible) throw new Error("debería estar disponible");
    expect(vista.a.puntos).toHaveLength(7);
    expect(vista.b!.puntos).toHaveLength(7);
    expect(vista.detalles.deals_creados.resumen.subtotal.cantidad).toBe(3);
    expect(vista.detalles.agendas_creadas.href).toContain("metrica=agendas_creadas");
    expect(vista.detalles.agendas_creadas.href).toContain("a_desde=2026-10-01");
    expect(vista.detalles.agendas_creadas.href).toContain("b_hasta=2026-09-09");
  });
});
