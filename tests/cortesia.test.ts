import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { marcarCortesia } from "@/lib/deals/cortesia";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { propiedadesQueLeFaltan } from "@/lib/deals/requisitos";
import { abonos, areas, calls, changeLog, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { hoyEnBogota } from "@/lib/format";
import { comisionesPorCloser } from "@/lib/queries/comision";
import { contarCortesias, embudoDelRango } from "@/lib/queries/dashboard";
import { estudiantesDe } from "@/lib/queries/estudiantes";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerente: string;
let closer: string;
let areaId: string;
let cohortId: string;
let secuencia = 0;
const HOY = hoyEnBogota();
const rango = { desde: HOY, hasta: HOY };

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "cortesias",
    nombre: "Cortesías",
    ticketUsd: "1000",
    comisionPorcentaje: "10",
  }).returning();
  programId = programa.id;
  gerente = (await db.insert(users).values({ email: "gerente@retia.test", rol: "gerente" }).returning())[0].id;
  closer = (await db.insert(users).values({ email: "closer@retia.test", rol: "closer", closerId: "Ana" }).returning())[0].id;
  areaId = (await db.insert(areas).values({ nombre: "Referidos" }).returning())[0].id;
  cohortId = (await db.insert(cohorts).values({
    programId,
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2026-12-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-11-30",
    estado: "activo",
  }).returning())[0].id;
}, 60_000);

afterEach(async () => cerrar());

async function crearDeal(opciones: { etapa?: "atendido" | "en_gestion"; area?: boolean; valor?: string | null } = {}) {
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `cortesia-${++secuencia}@retia.test`,
  }).returning();
  return (await db.insert(deals).values({
    leadId: lead.id,
    programId,
    cohortId,
    ownerUserId: closer,
    etapa: opciones.etapa ?? "atendido",
    areaDeclaradaId: opciones.area === false ? null : areaId,
    valorVendidoUsd: opciones.valor === undefined ? "500" : opciones.valor,
  }).returning())[0];
}

const comoGerente = () => ({ userId: gerente, rol: "gerente" as const });
const comoCloser = () => ({ userId: closer, rol: "closer" as const });

describe("marcar una cortesía", () => {
  it("la lleva a Completo con valor cero, rastro y requisitos satisfechos", async () => {
    const antes = await crearDeal();
    await marcarCortesia(db, comoGerente(), { dealId: antes.id });

    const [deal] = await db.select().from(deals).where(eq(deals.id, antes.id));
    expect(deal).toMatchObject({ etapa: "ganado_completo", cortesia: true, valorVendidoUsd: "0.00" });
    expect(await db.select().from(abonos).where(eq(abonos.dealId, deal.id))).toEqual([]);
    const campos = (await db.select().from(changeLog).where(eq(changeLog.registroId, deal.id))).map((r) => r.campo);
    expect(campos).toEqual(expect.arrayContaining(["cortesia", "valorVendidoUsd"]));
    const saldo = (await saldosDeDeals(db, [deal.id])).get(deal.id)!;
    expect(propiedadesQueLeFaltan(deal.etapa, {
      cortesia: deal.cortesia,
      tieneCohorte: deal.cohortId != null,
      tieneDueno: deal.ownerUserId != null,
      tieneContactoRegistrado: false,
      tieneLlamadaConFecha: false,
      llamadaSucedio: false,
      areaDeclaradaId: deal.areaDeclaradaId,
      fechaLimitePago: deal.fechaLimitePago,
      valorVendidoUsd: Number(deal.valorVendidoUsd),
      abonosVigentes: saldo.abonosVigentes,
      saldo: saldo.saldo,
      motivoId: deal.motivoId,
    })).toEqual([]);
  });

  it("rechaza al closer dueño y no mueve la fila", async () => {
    const antes = await crearDeal();
    await expect(marcarCortesia(db, comoCloser(), { dealId: antes.id })).rejects.toMatchObject({
      status: 403,
      message: "Marcar una cortesía es de quien administra.",
    });
    const [despues] = await db.select().from(deals).where(eq(deals.id, antes.id));
    expect(despues).toMatchObject({ etapa: antes.etapa, cortesia: false, valorVendidoUsd: antes.valorVendidoUsd });
  });

  it("rechaza un deal con abono vigente", async () => {
    const deal = await crearDeal();
    await db.insert(abonos).values({ dealId: deal.id, programId, fecha: HOY, monto: "1" });
    await expect(marcarCortesia(db, comoGerente(), { dealId: deal.id })).rejects.toMatchObject({ status: 409 });
  });

  it("rechaza una etapa que no tiene la transición permitida", async () => {
    const deal = await crearDeal({ etapa: "en_gestion" });
    await expect(marcarCortesia(db, comoGerente(), { dealId: deal.id })).rejects.toMatchObject({ status: 409 });
  });

  it("revierte marca y valor cuando el motor rechaza por falta de área", async () => {
    const antes = await crearDeal({ area: false });
    await expect(marcarCortesia(db, comoGerente(), { dealId: antes.id })).rejects.toThrow(/área/);
    const [despues] = await db.select().from(deals).where(eq(deals.id, antes.id));
    expect(despues).toMatchObject({ etapa: antes.etapa, cortesia: false, valorVendidoUsd: antes.valorVendidoUsd });
  });
});

describe("cortesías en estudiantes y métricas", () => {
  it("separa la cortesía de ventas, tasa, comisión y lista", async () => {
    const normal = await crearDeal({ valor: "1000" });
    await db.insert(abonos).values({ dealId: normal.id, programId, fecha: HOY, monto: "1000" });
    await moverEtapa(db, { dealId: normal.id, a: "ganado_completo", actor: { tipo: "sistema" } });
    const cortesia = await crearDeal();
    await marcarCortesia(db, comoGerente(), { dealId: cortesia.id });
    await db.insert(calls).values({ programId, dealId: normal.id, fechaLlamada: new Date(), resultado: "show" });

    const embudo = await embudoDelRango({ programId, rango }, db);
    expect(embudo).toMatchObject({ cierres: 1, pctCierre: 1 });
    expect(await comisionesPorCloser({ programId, rango }, db)).toEqual([
      expect.objectContaining({ closerId: "Ana", comisionUsd: 100, ventasSinComision: 0 }),
    ]);
    expect((await estudiantesDe(db, programId)).map((e) => e.dealId).sort()).toEqual([normal.id, cortesia.id].sort());
    expect(await contarCortesias({ programId, rango }, db)).toBe(1);

    const [listaCortesias] = await listaDeMetrica("cortesias", { programId, rango, hoy: HOY }, 1, db);
    const [listaCierres] = await listaDeMetrica("cierres", { programId, rango, hoy: HOY }, 1, db);
    expect(listaCortesias.subtotal.cantidad).toBe(1);
    expect(listaCortesias.filas.map((f) => f.dealId)).toEqual([cortesia.id]);
    expect(listaCierres.filas.map((f) => f.dealId)).toEqual([normal.id]);
  });
});
