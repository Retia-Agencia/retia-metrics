import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  MINIMO_DE_DEALS_PARA_CALOR,
  tonoDePorcentaje,
  tonosDeFila,
} from "@/lib/queries/calor-escalera";
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
  it.each([
    [0, 0],
    [4.9, 0],
    [5, 1],
    [19.9, 1],
    [20, 2],
    [49.9, 2],
    [50, 3],
    [100, 3],
  ] as const)("asigna a %s el tono %s", (porcentaje, tono) => {
    expect(tonoDePorcentaje(porcentaje)).toBe(tono);
  });

  it("normaliza cada fila por sus propios porcentajes", () => {
    const deCuarenta = tonosDeFila(fila(40, { pago_en_llamada: 80, pago_rapido: 20 }));
    const deCincuentaYSeis = tonosDeFila(fila(56, {
      pago_en_llamada: 4.9,
      pago_rapido: 5,
      pago_despues: 19.9,
      pago_sin_llamada: 50,
    }));

    expect(deCuarenta.pago_en_llamada).toBe(3);
    expect(deCuarenta.pago_rapido).toBe(2);
    expect(deCincuentaYSeis).toMatchObject({
      pago_en_llamada: 0,
      pago_rapido: 1,
      pago_despues: 1,
      pago_sin_llamada: 3,
    });
  });

  it("deja sin tono una fila con menos del mínimo", () => {
    expect(Object.values(tonosDeFila(fila(MINIMO_DE_DEALS_PARA_CALOR - 1, { pago_en_llamada: 100 }))))
      .toEqual(ESCALONES.map(() => null));
  });

  it("deja sin tono la fila sin dueño aunque tenga 515 deals", () => {
    expect(Object.values(tonosDeFila(fila(515, { pago_en_llamada: 100 }, true))))
      .toEqual(ESCALONES.map(() => null));
  });

  it("conserva sin tono un porcentaje nulo", () => {
    expect(tonosDeFila(fila(40, { pago_en_llamada: null })).pago_en_llamada).toBeNull();
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
