import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  armarReporteDiario, comoNacioLaVenta, desgloseDeCaja, resolverDiaDelReporte, resultadosPorCloser, totalDeConteos,
} from "@/lib/queries/reporte-diario";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/** Hub › Hoy como el reporte diario de Michael (373). */

describe("cómo nació la venta", () => {
  it("show el mismo día de la venta: agenda del día", () => {
    expect(comoNacioLaVenta("2026-11-03", ["2026-11-03"])).toBe("agenda_del_dia");
  });
  it("su último show fue un día anterior: seguimiento", () => {
    expect(comoNacioLaVenta("2026-11-03", ["2026-11-02"])).toBe("seguimiento");
  });
  it("sin show: sin llamada; un show posterior a la venta no la explica", () => {
    expect(comoNacioLaVenta("2026-11-03", [])).toBe("sin_llamada");
    expect(comoNacioLaVenta("2026-11-03", ["2026-11-04"])).toBe("sin_llamada");
  });
});

describe("el día del reporte (?fecha=)", () => {
  it("ausente es hoy, ayer se respeta, una fecha futura o mal escrita se rechaza", () => {
    expect(resolverDiaDelReporte(undefined, "2026-11-03")).toBe("2026-11-03");
    expect(resolverDiaDelReporte("2026-11-02", "2026-11-03")).toBe("2026-11-02");
    expect(resolverDiaDelReporte("2026-11-04", "2026-11-03")).toBeNull();
    expect(resolverDiaDelReporte("2026-02-31", "2026-11-03")).toBeNull();
    expect(resolverDiaDelReporte("ayer", "2026-11-03")).toBeNull();
  });
});

describe("qué pasó con cada agenda", () => {
  it("cuenta por closer, con el motivo de cada perdida, y las canceladas aparte", () => {
    const f = (resultado: string, motivo?: string) => ({ claveCloser: "a", closer: "Andrea", resultado, motivo });
    const [andrea] = resultadosPorCloser([
      f("cerrada"), f("no_show"), f("no_show"), f("reagendada"), f("reagendada"), f("perdida", "Precio"),
      f("agendada"), f("agendada"), f("agendada"), f("cancelada"),
    ]);
    expect(andrea).toMatchObject({ agendas: 9, cierre: 1, noShow: 2, reagendada: 2, pendiente: 3, canceladas: 1 });
    expect(andrea.perdidas).toEqual([{ motivo: "Precio", cantidad: 1 }]);
  });
});

describe("el total de todos los programas", () => {
  it("lleva solo conteos y caja por moneda, nunca una tasa", () => {
    const reporte = (registros: number, agendas: number, llamadasConShow: number, ventas: number, caja: number) => ({
      registros, ventas: Array(ventas).fill({}), caja: [{ moneda: "USD", total: caja }], vista: { embudo: { agendas, llamadasConShow } },
    });
    const total = totalDeConteos([reporte(10, 5, 2, 1, 100), reporte(20, 4, 1, 2, 50)]);
    expect(total).toEqual({ registros: 30, agendas: 9, realizadas: 3, ventas: 3, caja: [{ moneda: "USD", total: 150 }] });
    expect(Object.keys(total).some((k) => /pct|tasa|show$|cierre/i.test(k))).toBe(false);
  });
});

describe("el reporte contra la base", () => {
  const DIA = "2026-11-03";
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => { ({ db, cerrar, vaciar } = await crearBaseReutilizable()); });
  beforeEach(async () => { await vaciar(); }, 60_000);
  afterAll(async () => cerrar());

  async function sembrar() {
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p-a", nombre: "Programa A", ticketUsd: "797" }).returning();
    const [closer] = await db.insert(users).values({ email: "closer@retia.co", rol: "closer", nombre: "Jerónimo", closerId: "Jero" }).returning();
    const venta = async (correo: string, dia: string, valor: string, nombre: string) => {
      const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: correo, nombre }).returning();
      const [d] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, etapa: "ganado_parcial", valorVendidoUsd: valor, ownerUserId: closer.id }).returning();
      await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: "atendido", a: "ganado_parcial", fecha: new Date(`${dia}T15:00:00Z`) });
      return d;
    };
    return { programa, closer, venta };
  }

  it("clasifica las ventas del día por cómo nacieron", async () => {
    const { programa, venta } = await sembrar();
    const delDia = await venta("a@x.co", DIA, "797", "Con show hoy");
    const seguimiento = await venta("b@x.co", DIA, "797", "Con show ayer");
    await venta("c@x.co", DIA, "797", "Sin llamada");
    await db.insert(calls).values([
      { programId: programa.id, dealId: delDia.id, fechaAgenda: new Date(`${DIA}T14:00:00Z`), resultado: "cerrada" },
      { programId: programa.id, dealId: seguimiento.id, fechaAgenda: new Date("2026-11-02T14:00:00Z"), resultado: "show" },
    ]);
    const { ventas } = await armarReporteDiario({ programId: programa.id, dia: DIA }, db);
    const porPersona = Object.fromEntries(ventas.map((v) => [v.persona, v.nacio]));
    expect(porPersona).toEqual({ "Con show hoy": "agenda_del_dia", "Con show ayer": "seguimiento", "Sin llamada": "sin_llamada" });
  });

  it("un abono de saldo de una venta de otro día entra a caja, no suma cupo y dice la venta y el closer", async () => {
    const { programa, venta } = await sembrar();
    const anterior = await venta("d@x.co", "2026-08-31", "1500", "Maryce");
    await db.insert(abonos).values({ dealId: anterior.id, programId: programa.id, fecha: DIA, monto: "750", moneda: "USD" });
    const desglose = await desgloseDeCaja({ programId: programa.id, dia: DIA }, db);
    expect(desglose).toHaveLength(1);
    expect(desglose[0]).toMatchObject({ persona: "Maryce", origen: "saldo_anterior", ventaDelDia: "2026-08-31", closerDeLaVenta: "Jero", monto: 750 });
    const reporte = await armarReporteDiario({ programId: programa.id, dia: DIA }, db);
    expect(reporte.ventas).toHaveLength(0);
    expect(reporte.vista.embudo.cierres).toBe(0);
    expect(reporte.caja).toEqual([{ moneda: "USD", total: 750, deVentasDeHoy: 0, deVentasAnteriores: 750 }]);
  });

  it("el día pedido manda: ayer da las cifras de ayer", async () => {
    const { programa, venta } = await sembrar();
    await venta("e@x.co", "2026-11-02", "797", "De ayer");
    const ayer = await armarReporteDiario({ programId: programa.id, dia: "2026-11-02" }, db);
    const hoy = await armarReporteDiario({ programId: programa.id, dia: DIA }, db);
    expect(ayer.ventas.map((v) => v.persona)).toEqual(["De ayer"]);
    expect(hoy.ventas).toHaveLength(0);
  });
});
