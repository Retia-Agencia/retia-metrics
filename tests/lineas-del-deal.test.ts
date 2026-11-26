/** Líneas del deal como fuente de verdad: valor vendido, cupo, saldo y comisión viven en la línea. Es base porque los derivados salen de SQL sobre abonos y líneas. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import {
  cohorts, dealEtapaHistorial, dealLineas, deals, leads, plataformasPago,
  productos, programs, skus, users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearLineaSinClasificar } from "@/lib/deals/lineas";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import { cambiarCohorteDelDeal } from "@/lib/deals/cambiar-cohorte";
import {
  anularLinea, asignarLinea, editarValorDeLinea, quitarLinea,
} from "@/lib/deals/lineas";
import { saldosDeDeals, saldosDeLineas } from "@/lib/queries/saldo";
import { comisionesPorCloser } from "@/lib/queries/comision";
import { crearCohorte, editarCohorte } from "@/lib/catalogo/cohortes";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { skuVirtualDePrueba } from "./helpers/catalogo-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let cohort2Id: string;
let closerId: string;
let plataformaId: string;
let virtual1: string;
let virtual2: string;
let unoAUno1: string;

const actor = () => ({ userId: closerId, rol: "closer" as const, operaComoCloser: false });
const contexto = (etiqueta = "lineas@test.local") => ({ actorId: closerId, etiqueta });

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

// Las cohortes del test venden en noviembre de 2026: el día queda fijo para que no caduquen.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T17:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: "lineas-376", nombre: "Líneas 376", ticketUsd: "100",
  }).returning();
  programId = programa.id;
  [closerId] = (await db.insert(users).values({
    email: "lineas@retia.test", nombre: "Closer", rol: "closer", closerId: "Closer",
  }).returning()).map((fila) => fila.id);
  plataformaId = (await db.insert(plataformasPago).values({ nombre: "Prueba 376" }).returning())[0].id;
  const cohortes = await db.insert(cohorts).values([
    { programId, codigo: "C1", metaCupos: 10, precioUsd: "100", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" },
    { programId, codigo: "C2", metaCupos: 10, precioUsd: "120", fechaInicioVentas: "2026-12-01", fechaCierreVentas: "2026-12-31", fechaInicioClases: "2027-01-02" },
  ]).returning();
  cohortId = cohortes[0].id;
  cohort2Id = cohortes[1].id;
  const [virtual, unoAUno] = await db.insert(productos).values([
    { programId, nombre: "Programa virtual", slug: "programa_virtual" },
    { programId, nombre: "Uno a uno", slug: "uno_a_uno" },
  ]).returning();
  const filasSku = await db.insert(skus).values([
    { programId, nombre: virtual.nombre, slug: virtual.slug, productoId: virtual.id, cohortId, codigo: "lineas_376_programa_virtual_c1", precioListaUsd: "100", cuentaComoCupo: true, comisionPorcentaje: "10" },
    { programId, nombre: virtual.nombre, slug: virtual.slug, productoId: virtual.id, cohortId: cohort2Id, codigo: "lineas_376_programa_virtual_c2", precioListaUsd: "120", cuentaComoCupo: true, comisionPorcentaje: "10" },
    { programId, nombre: unoAUno.nombre, slug: unoAUno.slug, productoId: unoAUno.id, cohortId, codigo: "lineas_376_uno_a_uno_c1", precioListaUsd: "50" },
  ]).returning();
  virtual1 = filasSku[0].id;
  virtual2 = filasSku[1].id;
  unoAUno1 = filasSku[2].id;
});

afterAll(async () => cerrar());

async function crearDeal(etapa: typeof deals.$inferInsert.etapa = "compromiso_verbal") {
  const correo = `${crypto.randomUUID()}@lineas.test`;
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: correo, entrada: "crm" }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id, programId, cohortId, etapa, ownerUserId: closerId,
  }).returning();
  await db.insert(dealEtapaHistorial).values({
    dealId: deal.id, de: null, a: etapa, pendienteDe: null, pendienteA: null,
    userId: closerId, origen: "app",
  });
  return { deal, correo };
}

async function asignar(deal: typeof deals.$inferSelect, skuId: string, valor?: number) {
  return db.transaction((tx) => asignarLinea(tx as Db, {
    deal, skuId, valorVendidoUsd: valor, ...contexto(),
  }));
}

const pago = (dealId: string, monto: string, lineaId?: string) =>
  registrarAbono(db, actor(), {
    dealId, lineaId, fecha: "2026-11-19", monto, moneda: "USD",
    plataformaId, comprobanteUrl: "https://example.test/comprobante",
  });

// Desde el 460 el abono elige su línea: un adicional sin clasificar se asigna aparte y se paga por su id.
async function lineaSinClasificar(deal: typeof deals.$inferSelect, monto: number) {
  return db.transaction((tx) => crearLineaSinClasificar(tx as Db, {
    deal, montoUsd: monto, cohortId, actorId: closerId, etiqueta: "adicional",
  }));
}

describe("líneas como fuente de verdad: el valor, el cupo y la comisión viven en la línea", () => {
  it("el SKU virtual de prueba conserva su precio de lista al editar la cohorte", async () => {
    const cohorte = await crearCohorte(db, closerId, {
      programId, codigo: "PUENTE", metaCupos: 3, precioUsd: "275", fechaInicioVentas: null, fechaCierreVentas: null, fechaInicioClases: null,
    });
    await skuVirtualDePrueba(db, cohorte.id);
    const [skuCreado] = await db.select({ sku: skus, producto: productos }).from(skus)
      .innerJoin(productos, eq(productos.id, skus.productoId))
      .where(eq(skus.cohortId, cohorte.id));
    expect(skuCreado.producto).toMatchObject({ nombre: "Programa virtual", slug: "programa_virtual" });
    const [programa] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(skuCreado.sku).toMatchObject({
      codigo: "lineas_376_programa_virtual_puente", precioListaUsd: "275.00", cuentaComoCupo: true,
      comisionPorcentaje: programa.comisionPorcentaje,
    });

    await editarCohorte(db, closerId, cohorte.id, {
      programId, codigo: "PUENTE", metaCupos: 3, precioUsd: "300", fechaInicioVentas: null, fechaCierreVentas: null, fechaInicioClases: null,
    });
    expect((await db.select().from(skus).where(eq(skus.id, skuCreado.sku.id)))[0].precioListaUsd)
      .toBe("275.00");
  });

  it("mantiene derivados después de asignar, editar, quitar, pagar, anular pago y anular línea", async () => {
    const { deal } = await crearDeal();
    const linea = await asignar(deal, virtual1, 90);
    let actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    expect(actual.cohortId).toBe(cohortId);
    expect(actual.valorVendidoUsd).toBeNull();

    await db.transaction((tx) => editarValorDeLinea(tx as Db, {
      deal: actual, lineaId: linea.id, valorVendidoUsd: 80, ...contexto(),
    }));
    actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    expect(actual.valorVendidoUsd).toBeNull();

    const propuesta = await asignar(actual, unoAUno1, 50);
    await db.transaction((tx) => quitarLinea(tx as Db, { deal: actual, lineaId: propuesta.id, ...contexto() }));
    const registrado = await pago(deal.id, "30", linea.id);
    actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    expect(actual.valorVendidoUsd).toBe("80.00");
    expect(actual.cohortId).toBe(cohortId);

    await anularAbono(db, actor(), { abonoId: registrado.abonoId, motivo: "Captura equivocada" });
    actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    expect(actual.valorVendidoUsd).toBeNull();

    await db.transaction((tx) => anularLinea(tx as Db, { deal: actual, lineaId: linea.id, ...contexto() }));
    actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    expect(actual.valorVendidoUsd).toBeNull();
    expect(actual.cohortId).toBe(cohortId); // sin líneas de cupo, conserva el valor actual
  });

  it("calcula D15 por líneas vendidas y no deja que una propuesta impida completo", async () => {
    const { deal } = await crearDeal();
    const virtual = await asignar(deal, virtual1, 100);
    const unoAUno = await asignar(deal, unoAUno1, 50);
    const primero = await pago(deal.id, "40", virtual.id);
    expect(primero.etapa).toBe("ganado_parcial");
    await pago(deal.id, "20", unoAUno.id);
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].etapa).toBe("ganado_parcial");
    await pago(deal.id, "60", virtual.id);
    const ultimo = await pago(deal.id, "30", unoAUno.id);
    expect(ultimo.etapa).toBe("ganado_completo");

    const propuesta = await asignar((await db.select().from(deals).where(eq(deals.id, deal.id)))[0], unoAUno1, 25);
    expect(propuesta.id).toBeTruthy();
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].etapa).toBe("ganado_completo");

    await anularAbono(db, actor(), { abonoId: ultimo.abonoId, motivo: "Pago reversado" });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].etapa).toBe("ganado_parcial");
  });

  it("ADR 0137 punto 15: la línea con cupo sin abonos solo vende en un deal ganado sin otros abonos", async () => {
    const ganado = await crearDeal("ganado_parcial");
    const cupoVendido = await asignar(ganado.deal, virtual1, 100);
    expect((await saldosDeLineas(db, [ganado.deal.id])).get(cupoVendido.id)).toMatchObject({
      vendida: true, abonado: 0, saldo: 100,
    });

    const conOtroAbono = await crearDeal("ganado_parcial");
    const cupoPropuesto = await asignar(conOtroAbono.deal, virtual1, 100);
    const otraLinea = await asignar(conOtroAbono.deal, unoAUno1, 50);
    await pago(conOtroAbono.deal.id, "50", otraLinea.id);
    const saldosConAbono = await saldosDeLineas(db, [conOtroAbono.deal.id]);
    expect(saldosConAbono.get(cupoPropuesto.id)?.vendida).toBe(false);
    expect(saldosConAbono.get(otraLinea.id)?.vendida).toBe(true);

    const abierto = await crearDeal("atendido");
    const propuesta = await asignar(abierto.deal, virtual1, 100);
    expect((await saldosDeLineas(db, [abierto.deal.id])).get(propuesta.id)?.vendida).toBe(false);
  });

  it("saldo del deal suma líneas vendidas y el sobrepago se rechaza por su línea", async () => {
    const { deal } = await crearDeal();
    const virtual = await asignar(deal, virtual1, 100);
    const unoAUno = await asignar(deal, unoAUno1, 50);
    await pago(deal.id, "40", virtual.id);
    await pago(deal.id, "20", unoAUno.id);
    const saldoDeal = (await saldosDeDeals(db, [deal.id])).get(deal.id)!;
    const saldos = await saldosDeLineas(db, [deal.id]);
    expect(saldoDeal).toMatchObject({ precio: 150, abonado: 60, saldo: 90 });
    expect([...saldos.values()].filter((linea) => linea.vendida).reduce((n, linea) => n + linea.saldo!, 0)).toBe(90);
    await expect(pago(deal.id, "61", virtual.id)).rejects.toThrow("supera el saldo de la línea");
  });

  it("ADR 0137 enmienda del 20-nov: la línea sin clasificar no paga comisión", async () => {
    const { deal } = await crearDeal();
    // Abono parcial al programa (el deal sigue abierto) y el 1:1 aparte.
    await pago(deal.id, "40");
    const adicional = await lineaSinClasificar(deal, 25);
    await pago(deal.id, "25", adicional.id);
    const lineas = await db.select().from(dealLineas).where(eq(dealLineas.dealId, deal.id));
    expect(lineas.map((linea) => linea.comisionPorcentaje).sort()).toEqual(["0.00", "10.00"]);

    const [fila] = await comisionesPorCloser({ programId, rango: { desde: "2026-11-01", hasta: "2026-11-30" } }, db);
    expect(fila.comisionUsd).toBe(10);
    expect(fila.ventasSinComision).toBe(0);
  });

  it("ADR 0137 enmienda del 20-nov: un SKU con 0 % no paga comisión y uno con % nulo sí", async () => {
    await db.update(skus).set({ comisionPorcentaje: "0" }).where(eq(skus.id, unoAUno1));
    const { deal } = await crearDeal();
    const virtual = await asignar(deal, virtual1, 100);
    const unoAUno = await asignar(deal, unoAUno1, 50);
    await pago(deal.id, "40", virtual.id);
    await pago(deal.id, "50", unoAUno.id);
    const [conCero] = await comisionesPorCloser({ programId, rango: { desde: "2026-11-01", hasta: "2026-11-30" } }, db);
    expect(conCero.comisionUsd).toBe(10);

    // El porcentaje ya quedó congelado: cambiar el SKU no altera la comisión de esta línea.
    await db.update(skus).set({ comisionPorcentaje: null }).where(eq(skus.id, unoAUno1));
    const [conNulo] = await comisionesPorCloser({ programId, rango: { desde: "2026-11-01", hasta: "2026-11-30" } }, db);
    expect(conNulo.comisionUsd).toBe(10);
  });

  it("cambiar cohorte mueve la línea con cupo y no la duplica", async () => {
    const { deal, correo } = await crearDeal();
    const linea = await asignar(deal, virtual1, 90);
    const actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    const destino = (await db.select().from(cohorts).where(eq(cohorts.id, cohort2Id)))[0];
    await db.transaction((tx) => cambiarCohorteDelDeal(tx as Db, {
      deal: actual, destino, actorId: closerId, etiqueta: correo, nota: () => "Cambio de cohorte",
    }));
    const vigentes = await db.select().from(dealLineas).where(and(eq(dealLineas.dealId, deal.id), isNull(dealLineas.anuladaEn)));
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0].id).toBe(linea.id);
    expect(vigentes[0].skuId).toBe(virtual2);
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].cohortId).toBe(cohort2Id);
  });
});
