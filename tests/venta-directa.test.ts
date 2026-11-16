import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  abonos,
  avisosEstudianteNuevo,
  cohorts,
  deals,
  eventosMeta,
  integraciones,
  leads,
  plataformasPago,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { registrarVentaDeLaPasarela } from "@/lib/deals/venta-de-la-pasarela";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let vaciar: () => Promise<void>;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let plataformaId: string;
let closerId: string;
let gerenteId: string;
let secuencia = 0;

beforeAll(async () => {
  ({ db, vaciar, cerrar } = await crearBaseReutilizable());
  // La migración la genera la sesión principal; este archivo prueba el esquema declarado por el ticket 451.
  await db.execute(sql.raw("alter type origen_cambio add value if not exists 'hotmart'"));
  await db.execute(sql.raw("alter table abonos add column if not exists referencia_externa text"));
  await db.execute(sql.raw("create unique index if not exists abonos_origen_referencia_externa_idx on abonos (origen, referencia_externa) where referencia_externa is not null"));
});

beforeEach(async () => {
  await vaciar();
  secuencia += 1;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: `venta-directa-${secuencia}`,
    nombre: `Venta directa ${secuencia}`,
    ticketUsd: "149",
  }).returning();
  programId = programa.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: `C-${secuencia}`,
    metaCupos: 10,
    precioUsd: "149",
    fechaInicioClases: "2026-12-01",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-11-30",
    estado: "activo",
  }).returning();
  cohortId = cohorte.id;
  plataformaId = (await db.insert(plataformasPago).values({ nombre: `Hotmart ${secuencia}` }).returning())[0].id;
  closerId = (await db.insert(users).values({ email: `closer-${secuencia}@retia.co`, rol: "closer" }).returning())[0].id;
  gerenteId = (await db.insert(users).values({ email: `gerente-${secuencia}@retia.co`, rol: "gerente" }).returning())[0].id;
});

afterAll(async () => cerrar());

async function nuevoDeal(etapa: EtapaDeal, ownerUserId: string | null = null) {
  const [lead] = await db.insert(leads).values({
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    programId,
    emailNormalizado: `venta-${secuencia}-${crypto.randomUUID()}@retia.co`,
  }).returning();
  return (await db.insert(deals).values({
    programId,
    leadId: lead.id,
    cohortId,
    etapa,
    ownerUserId,
  }).returning())[0];
}

const pago = (dealId: string, monto: string | number, referenciaExterna = crypto.randomUUID()) => ({
  dealId,
  monto,
  moneda: "USD" as const,
  plataformaId,
  fecha: "2026-11-16",
  origen: "hotmart" as const,
  referenciaExterna,
});

describe("registrarVentaDeLaPasarela", () => {
  it.each(["potencial", "registrado", "calificado"] as const)(
    "registra un completo sin dueño desde %s por S4",
    async (etapa) => {
      const deal = await nuevoDeal(etapa);
      const resultado = await registrarVentaDeLaPasarela(db, pago(deal.id, "149"));

      expect(resultado).toMatchObject({
        repetida: false,
        etapa: "ganado_completo",
        movioElDeal: true,
        saldo: 0,
        ventaDirecta: true,
      });
      const [actual] = await db.select().from(deals).where(eq(deals.id, deal.id));
      const [abono] = await db.select().from(abonos).where(eq(abonos.dealId, deal.id));
      expect(actual).toMatchObject({
        etapa: "ganado_completo",
        ownerUserId: null,
        valorVendidoUsd: "149.00",
        ventaDirectaEn: expect.any(Date),
      });
      expect(abono).toMatchObject({
        registradoPorUserId: null,
        closerId: null,
        origen: "hotmart",
        referenciaExterna: expect.any(String),
      });
    },
  );

  it("completa en dos pagos y pone al parcial el cierre comercial de la cohorte", async () => {
    const deal = await nuevoDeal("calificado");
    const primero = await registrarVentaDeLaPasarela(db, pago(deal.id, 99, "compra-parcial"));
    expect(primero).toMatchObject({ etapa: "ganado_parcial", saldo: 50, ventaDirecta: true });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      fechaLimitePago: "2026-11-30",
      ownerUserId: null,
      ventaDirectaEn: expect.any(Date),
    });

    const segundo = await registrarVentaDeLaPasarela(db, pago(deal.id, 50, "compra-saldo"));
    expect(segundo).toMatchObject({ etapa: "ganado_completo", saldo: 0, ventaDirecta: true });
  });

  it.each(["atendido", "calificado"] as const)("usa las flechas normales cuando el deal %s tiene dueño", async (etapa) => {
    const deal = await nuevoDeal(etapa, closerId);
    const resultado = await registrarVentaDeLaPasarela(db, pago(deal.id, 149));
    expect(resultado).toMatchObject({ etapa: "ganado_completo", ventaDirecta: false });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      ownerUserId: closerId,
      ventaDirectaEn: null,
    });
  });

  it("devuelve la misma compra repetida y deja un solo abono", async () => {
    const deal = await nuevoDeal("calificado");
    const entrada = pago(deal.id, 149, "referencia-unica");
    const primera = await registrarVentaDeLaPasarela(db, entrada);
    const segunda = await registrarVentaDeLaPasarela(db, entrada);
    expect(segunda).toMatchObject({ abonoId: primera.abonoId, repetida: true, movioElDeal: false });
    expect(await db.select().from(abonos).where(eq(abonos.dealId, deal.id))).toHaveLength(1);
  });

  it("rechaza un deal anulado sin registrar el abono", async () => {
    const deal = await nuevoDeal("calificado");
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: gerenteId, motivoAnulacion: "Duplicado" }).where(eq(deals.id, deal.id));
    await expect(registrarVentaDeLaPasarela(db, pago(deal.id, 149))).rejects.toMatchObject({ status: 409 });
    expect(await db.select().from(abonos).where(eq(abonos.dealId, deal.id))).toHaveLength(0);
  });

  it("encola Purchase y el aviso de estudiante después de S4", async () => {
    await db.insert(integraciones).values({
      programId,
      tipo: "meta_capi",
      secretos: { token: "token-prueba" },
      config: { datasetId: "dataset-prueba", encendido: true },
    });
    const deal = await nuevoDeal("calificado");
    await registrarVentaDeLaPasarela(db, pago(deal.id, 149));
    expect(await db.select().from(eventosMeta).where(eq(eventosMeta.dealId, deal.id))).toHaveLength(1);
    expect(await db.select().from(avisosEstudianteNuevo).where(eq(avisosEstudianteNuevo.dealId, deal.id))).toHaveLength(1);
  });

  it("moverEtapa rechaza S4 para un usuario y para un deal con dueño", async () => {
    const sinDueno = await nuevoDeal("calificado");
    await expect(moverEtapa(db, {
      dealId: sinDueno.id,
      a: "ganado_completo",
      actor: { tipo: "usuario", userId: gerenteId, rol: "gerente", operaComoCloser: false },
      ventaDirecta: true,
    })).rejects.toMatchObject({ status: 403 });

    const conDueno = await nuevoDeal("calificado", closerId);
    await expect(moverEtapa(db, {
      dealId: conDueno.id,
      a: "ganado_completo",
      actor: { tipo: "sistema" },
      ventaDirecta: true,
    })).rejects.toMatchObject({ status: 409 });
  });
});
