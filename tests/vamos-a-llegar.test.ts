import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { cohorts, dealEtapaHistorial, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { PropsVamosALlegar } from "@/components/metas/vamos-a-llegar";
import { leerVamosALlegar, celdaDeMeta } from "@/lib/queries/vamos-a-llegar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";

/**
 * Ticket 371: "¿Vamos a llegar?" — mes y cohorte × cupos y USD, sin leer ningun filtro.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let n = 0;

const CIERRE = "2026-11-04"; // ultimo dia habil de la ventana de la cohorte (12-oct a 4-nov)

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p371", nombre: "P371", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db.insert(cohorts).values({
    programId, codigo: "C3", metaCupos: 20, precioUsd: "1000",
    fechaInicioClases: "2026-12-01", fechaInicioVentas: "2026-10-12", fechaCierreVentas: CIERRE, estado: "activo",
  }).returning();
  cohortId = c.id;
});

async function venta(dia: string, valorVendidoUsd: string | null = "900") {
  const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `l${++n}@t371.test` }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, cohortId, etapa: "ganado_parcial", valorVendidoUsd, ownerUserId: await duenoDePrueba(db, programId) }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date(`${dia}T11:00:00-05:00`) });
}

describe("371: las cuatro combinaciones", () => {
  it("meta USD de la cohorte = meta de cupos x precio; llevamos USD = Vendido de la cohorte", async () => {
    for (let i = 0; i < 16; i++) await venta("2026-10-14", "900");
    const datos = await leerVamosALlegar(programId, CIERRE, db);
    const { cupos, usd } = datos.cohorte!.cuadrante;
    expect(cupos.meta).toBe(20);
    expect(usd.meta).toBe(20 * 1000);
    expect(cupos.llevamos).toBe(16);
    expect(usd.llevamos).toBe(16 * 900);
    expect(usd.faltan).toBe(20000 - 14400);
  });

  it("el ultimo dia habil, por dia habil que queda es el faltante entero (borde del 352)", async () => {
    for (let i = 0; i < 16; i++) await venta("2026-10-14", "900");
    const { cupos, usd } = (await leerVamosALlegar(programId, CIERRE, db)).cohorte!.cuadrante;
    expect(cupos.porDiaHabil).toBe(4);
    expect(usd.porDiaHabil).toBe(5600);
  });

  it("las ventas de hoy no bajan el por dia habil de hoy (meta de apertura)", async () => {
    for (let i = 0; i < 16; i++) await venta("2026-10-14", "900");
    for (let i = 0; i < 3; i++) await venta(CIERRE, "900");
    const { cupos } = (await leerVamosALlegar(programId, CIERRE, db)).cohorte!.cuadrante;
    expect(cupos.llevamos).toBe(19);
    expect(cupos.porDiaHabil).toBe(4);
  });

  it("el mes lleva solo las ventas del mes; la cohorte lleva todas (DA-2)", async () => {
    await venta("2026-10-14");
    await venta("2026-11-03");
    const datos = await leerVamosALlegar(programId, CIERRE, db);
    expect(datos.mes.cuadrante.cupos.llevamos).toBe(1);
    expect(datos.cohorte!.cuadrante.cupos.llevamos).toBe(2);
  });

  it("una venta sin valor vendido se avisa y no cuenta como cero silencioso", async () => {
    await venta("2026-11-03", null);
    const datos = await leerVamosALlegar(programId, CIERRE, db);
    expect(datos.cohorte!.cuadrante.ventasSinValorVendido).toBe(1);
    expect(datos.mes.cuadrante.ventasSinValorVendido).toBe(1);
  });

  it("sin cohorte activa la cohorte es nula; el mes sigue con la meta de 146", async () => {
    await db.update(cohorts).set({ estado: "cerrado" });
    const datos = await leerVamosALlegar(programId, CIERRE, db);
    expect(datos.cohorte).toBeNull();
    // El mes sigue tomando la meta de toda cohorte cuya ventana toque el mes (146), este o no activa.
    expect(datos.mes.sinMeta).toBe(false);
    expect(datos.mes.cuadrante.cupos.meta).toBeGreaterThan(0);
  });
});

describe("371: sin meta no hay porcentaje", () => {
  it("meta cero o nula da celda vacia, nunca 0 %", () => {
    for (const meta of [null, 0]) {
      const c = celdaDeMeta({ llevamos: 3, meta, esperado: null, antesDeHoy: 0, hoy: CIERRE, cierre: CIERRE });
      expect(c.pct).toBeNull();
      expect(c.faltan).toBeNull();
      expect(c.porDiaHabil).toBeNull();
    }
  });

  it("el color sale del umbral: rojo si la alerta esta disparada, ambar bajo el aceptable, verde si no", () => {
    const base = { llevamos: 5, meta: 20, esperado: 10, antesDeHoy: 5, hoy: CIERRE, cierre: CIERRE };
    expect(celdaDeMeta({ ...base, umbral: { aceptable: 80, disparada: true } }).tono).toBe("peligro");
    expect(celdaDeMeta({ ...base, umbral: { aceptable: 80, disparada: false } }).tono).toBe("atencion");
    expect(celdaDeMeta({ ...base, llevamos: 9, umbral: { aceptable: 80, disparada: false } }).tono).toBe("ok");
    expect(celdaDeMeta(base).tono).toBe("neutro");
  });
});

describe("371: el bloque no admite filtros", () => {
  it("la lectura recibe solo programa y hoy", () => {
    expectTypeOf(leerVamosALlegar).parameters.toEqualTypeOf<[string, string, Db?]>();
  });

  it("pasarle un periodo, una cohorte o un closer al componente no compila", () => {
    const base: PropsVamosALlegar = {
      programa: { id: "p", slug: "s", nombre: "N" }, hoy: CIERRE, origen: "/hub", conListas: true, configurar: null,
    };
    // @ts-expect-error el bloque no admite periodo
    const conPeriodo: PropsVamosALlegar = { ...base, periodo: { preset: "mes" } };
    // @ts-expect-error ni cohorte
    const conCohorte: PropsVamosALlegar = { ...base, cohorteId: "c" };
    // @ts-expect-error ni closer
    const conCloser: PropsVamosALlegar = { ...base, claveCloser: "mani" };
    expect([conPeriodo, conCohorte, conCloser]).toHaveLength(3);
  });
});
