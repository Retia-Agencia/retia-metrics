import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, cohorts, deals, enlacesPago, leads, plataformasPago, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { pagosDeStudents } from "@/lib/queries/pagos-de-students";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramaId: string;
let cohortId: string;
let otraCohortId: string;
let registradorId: string;
let anuladorId: string;
let n = 0;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa, otroPrograma] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "students-pagos", nombre: "Students pagos", ticketUsd: "1200" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro-students-pagos", nombre: "Otro", ticketUsd: "900" },
    ])
    .returning();
  programId = programa.id;
  otroProgramaId = otroPrograma.id;

  const [cohorte, otraCohorte] = await db
    .insert(cohorts)
    .values([
      {
        programId,
        codigo: "P-1",
        metaCupos: 10,
        precioUsd: "1200",
        fechaInicioVentas: "2026-10-01",
        fechaCierreVentas: "2026-10-31",
        fechaInicioClases: "2026-11-10",
        estado: "activo",
      },
      {
        programId: otroProgramaId,
        codigo: "Q-1",
        metaCupos: 10,
        precioUsd: "900",
        fechaInicioVentas: "2026-10-01",
        fechaCierreVentas: "2026-10-31",
        fechaInicioClases: "2026-11-10",
        estado: "activo",
      },
    ])
    .returning();
  cohortId = cohorte.id;
  otraCohortId = otraCohorte.id;

  const [registrador, anulador] = await db
    .insert(users)
    .values([
      { email: "registro-pagos@retia.test", nombre: "Quien registra", rol: "gerente", closerId: "Registro legado" },
      { email: "anula-pagos@retia.test", nombre: "Quien anula", rol: "gerente" },
    ])
    .returning();
  registradorId = registrador.id;
  anuladorId = anulador.id;
});

afterAll(async () => {
  await cerrar();
});

async function crearDeal(programa = programId, cohorte = cohortId) {
  const [lead] = await db
    .insert(leads)
    .values({
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
      programId: programa,
      emailNormalizado: `pagos-student-${++n}@correo.co`,
      nombre: `Student ${n}`,
    })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({
      leadId: lead.id,
      programId: programa,
      cohortId: cohorte,
      ownerUserId: registradorId,
      etapa: "ganado_parcial",
      valorVendidoUsd: "1000",
      acuerdoPago: "Dos cuotas",
      fechaLimitePago: "2026-11-30",
    })
    .returning();
  return deal;
}

describe("pagosDeStudents", () => {
  it("devuelve todos los abonos, incluidos los anulados, con sus datos relacionados", async () => {
    const deal = await crearDeal();
    const [plataforma] = await db
      .insert(plataformasPago)
      .values({ nombre: "Stripe" })
      .returning();
    const [enlace] = await db
      .insert(enlacesPago)
      .values({
        programId,
        plataformaId: plataforma.id,
        nombre: "Cuota inicial",
        monto: "400",
        moneda: "USD",
        url: "https://pago.test/cuota",
      })
      .returning();

    await db.insert(abonos).values([
      {
        dealId: deal.id,
        programId,
        fecha: "2026-11-02",
        monto: "400",
        concepto: "ticket",
        nota: "Primera cuota",
        plataformaId: plataforma.id,
        enlacePagoId: enlace.id,
        comprobanteUrl: "https://comprobantes.test/uno",
        registradoPorUserId: registradorId,
        closerId: "Registro legado",
      },
      {
        dealId: deal.id,
        programId,
        fecha: "2026-11-01",
        monto: "200",
        concepto: "ticket",
        anuladoEn: new Date("2026-11-03T15:00:00-05:00"),
        anuladoPor: anuladorId,
        motivoAnulacion: "Pago duplicado",
      },
    ]);

    const pagos = (await pagosDeStudents(db, programId, [deal.id])).get(deal.id)!;

    expect(pagos.abonos).toHaveLength(2);
    expect(pagos.abonos[1]).toMatchObject({
      anuladoEn: expect.any(Date),
      motivoAnulacion: "Pago duplicado",
      anuladoPorNombre: "Quien anula",
    });
    expect(pagos.abonos[0]).toMatchObject({
      comprobanteUrl: "https://comprobantes.test/uno",
      comprobanteArchivoId: null,
      plataformaNombre: "Stripe",
      enlacePagoNombre: "Cuota inicial",
      registradoPorNombre: "Quien registra",
    });
  });

  it("usa exactamente el saldo central y excluye el abono anulado de abonado", async () => {
    const deal = await crearDeal();
    await db.insert(abonos).values([
      { dealId: deal.id, programId, fecha: "2026-11-02", monto: "400", concepto: "ticket" },
      {
        dealId: deal.id,
        programId,
        fecha: "2026-11-01",
        monto: "200",
        concepto: "ticket",
        anuladoEn: new Date("2026-11-03T15:00:00-05:00"),
        anuladoPor: anuladorId,
        motivoAnulacion: "Pago duplicado",
      },
    ]);

    const esperado = (await saldosDeDeals(db, [deal.id])).get(deal.id);
    const pagos = (await pagosDeStudents(db, programId, [deal.id])).get(deal.id)!;

    expect(pagos.saldo).toEqual(esperado);
    expect(pagos.saldo.abonado).toBe(400);
    expect(pagos.saldo.saldo).toBe(600);
    expect(pagos.descuento).toEqual({ usd: 200, porcentaje: 200 / 1200 });
  });

  it("no cruza abonos ni deals de otro programa", async () => {
    const deal = await crearDeal();
    const dealAjeno = await crearDeal(otroProgramaId, otraCohortId);
    await db.insert(abonos).values([
      { dealId: deal.id, programId, fecha: "2026-11-02", monto: "400" },
      { dealId: dealAjeno.id, programId: otroProgramaId, fecha: "2026-11-02", monto: "900" },
    ]);

    const pagos = await pagosDeStudents(db, programId, [deal.id, dealAjeno.id]);

    expect(pagos.has(dealAjeno.id)).toBe(false);
    expect(pagos.get(deal.id)?.abonos.map((abono) => abono.monto)).toEqual(["400.00"]);
  });

  it("devuelve una lista vacía para un student sin abonos", async () => {
    const deal = await crearDeal();

    const pagos = (await pagosDeStudents(db, programId, [deal.id])).get(deal.id)!;

    expect(pagos.abonos).toEqual([]);
    expect(pagos.saldo.abonado).toBe(0);
  });
});
