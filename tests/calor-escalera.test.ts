import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { intensidadesDeFila } from "@/lib/queries/calor-escalera";
import { ESCALONES, type Escalon } from "@/lib/queries/escalera";
import type { FilaDeEscalera } from "@/lib/queries/vista-escalera";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

function fila(
  total: number,
  porcentajes: Partial<Record<Escalon, number | null>>,
  esSinDueno = false,
): FilaDeEscalera {
  const celdas = Object.fromEntries(ESCALONES.map((escalon) => [escalon, {
    deals: 0,
    porcentaje: { valor: Object.hasOwn(porcentajes, escalon) ? porcentajes[escalon] ?? null : 0 },
    diasMedianos: null,
    anterior: null,
    detalle: null,
  }])) as FilaDeEscalera["celdas"];
  return { clave: "fila", etiqueta: "Fila", esSinDueno, total, celdas };
}

describe("calor de la escalera", () => {
  it("la intensidad es el porcentaje de la celda sobre su propia fila, de 0 a 1", () => {
    const i = intensidadesDeFila(fila(40, { pago_en_llamada: 80, pago_rapido: 20 }));
    expect(i.pago_en_llamada).toBeCloseTo(0.8);
    expect(i.pago_rapido).toBeCloseTo(0.2);
    expect(i.pago_despues).toBe(0);
  });

  it("no depende del tamaño de la fila: 4 deals y 515 con el mismo porcentaje dan lo mismo", () => {
    expect(intensidadesDeFila(fila(4, { pago_en_llamada: 50 })).pago_en_llamada)
      .toBe(intensidadesDeFila(fila(515, { pago_en_llamada: 50 })).pago_en_llamada);
  });

  it("deja sin calor la fila sin dueño aunque tenga 515 deals", () => {
    expect(Object.values(intensidadesDeFila(fila(515, { pago_en_llamada: 100 }, true))))
      .toEqual(ESCALONES.map(() => null));
  });

  it("deja sin calor un porcentaje nulo y acota lo que se salga de 0 a 100", () => {
    const i = intensidadesDeFila(fila(40, { pago_en_llamada: null, pago_rapido: 120, pago_despues: -3 }));
    expect(i.pago_en_llamada).toBeNull();
    expect(i.pago_rapido).toBe(1);
    expect(i.pago_despues).toBe(0);
  });
});

describe("vista de escalera", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });
  afterAll(async () => cerrar());
  beforeEach(async () => vaciar());

  it("marca esSinDueno solo en el grupo cuyo closer es nulo", async () => {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "calor",
      nombre: "Calor",
      ticketUsd: "100",
      cortePagoRapidoDias: 3,
    }).returning();
    const [closer] = await db.insert(users).values({
      email: "closer-calor@x.test",
      rol: "closer",
      closerId: "Closer Calor",
    }).returning();
    const personas = await db.insert(leads).values([
      { programId: programa.id, emailNormalizado: "con-closer@x.test" },
      { programId: programa.id, emailNormalizado: "sin-closer@x.test" },
    ]).returning();
    await db.insert(deals).values([
      { programId: programa.id, leadId: personas[0].id, ownerUserId: closer.id, etapa: "contactado", createdAt: new Date("2026-10-02T12:00:00-05:00") },
      { programId: programa.id, leadId: personas[1].id, ownerUserId: null, etapa: "contactado", createdAt: new Date("2026-10-02T12:00:00-05:00") },
    ]);

    const vista = await vistaDeEscalera({
      programId: programa.id,
      slug: programa.slug,
      hoy: "2026-10-31",
      periodo: { preset: "custom", a: { desde: "2026-10-01", hasta: "2026-10-31" }, b: null },
      claveCloser: null,
      origen: "/p/calor/hub",
      conEquipo: true,
    }, db);

    expect(vista.principal.esSinDueno).toBe(false);
    expect(vista.porCalidad.every((grupo) => !grupo.esSinDueno)).toBe(true);
    expect(vista.porCloser.filter((grupo) => grupo.esSinDueno).map((grupo) => grupo.etiqueta)).toEqual(["Sin closer"]);
    expect(vista.porCloser.filter((grupo) => !grupo.esSinDueno)).toHaveLength(1);
  });
});
