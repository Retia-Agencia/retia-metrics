import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { abonos, calls, cohorts, deals, leads, motivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moverConHecho } from "@/lib/deals/mover-con-hecho";
import { resumenDelCambio } from "@/lib/deals/resumen-del-cambio";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let closerId: string;
let motivoOtroId: string;
let secuencia = 0;

const actor = () => ({ userId: closerId, rol: "closer" as const });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  programId = (await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "mover-con-hecho",
    nombre: "Mover con hecho",
    ticketUsd: "1000",
  }).returning())[0].id;
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
  closerId = (await db.insert(users).values({ email: "closer-mover-hecho@retia.co", rol: "closer" }).returning())[0].id;
  motivoOtroId = (await db.insert(motivos).values({ nombre: "Otro", tipo: "reagenda", pideTexto: true }).returning())[0].id;
});

afterEach(async () => cerrar());

async function nuevoDeal(etapa: EtapaDeal) {
  const leadId = (await db.insert(leads).values({
    programId,
    emailNormalizado: `mover-hecho-${secuencia++}@retia.co`,
  }).returning())[0].id;
  return (await db.insert(deals).values({
    leadId,
    programId,
    cohortId,
    ownerUserId: closerId,
    etapa,
    valorVendidoUsd: "1000",
  }).returning())[0];
}

async function etapaDe(dealId: string) {
  return (await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId)))[0].etapa;
}

describe("moverConHecho", () => {
  it("Agendado → Atendido marca Show y pega Grain en una sola llamada", async () => {
    const deal = await nuevoDeal("agendado");
    const callId = (await db.insert(calls).values({
      dealId: deal.id,
      programId,
      cohortId,
      closerUserId: closerId,
      fechaAgenda: new Date("2026-10-10T15:00:00Z"),
      resultado: "agendada",
      origen: "crm",
    }).returning())[0].id;

    const { cambio } = await moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "atendido",
      hecho: { tipo: "atendido", callId, linkGrain: "https://grain.com/share/prueba" },
    });

    expect(await etapaDe(deal.id)).toBe("atendido");
    expect((await db.select().from(calls).where(eq(calls.id, callId)))[0]).toMatchObject({
      resultado: "show",
      linkGrain: "https://grain.com/share/prueba",
    });
    // El cambio se arma desde lo escrito, y de ahí sale el aviso (ticket 220).
    expect(cambio.etapaDespues).toBe("atendido");
    expect(resumenDelCambio(cambio)).toContain("El deal pasó a Atendido.");
  });

  it("Compromiso Verbal → Ganado registra el abono", async () => {
    const deal = await nuevoDeal("compromiso_verbal");
    await moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "ganado_parcial",
      hecho: { tipo: "abono", fecha: "2026-10-09", monto: "250", moneda: "USD" },
    });
    expect(await etapaDe(deal.id)).toBe("ganado_parcial");
    expect(await db.select().from(abonos).where(eq(abonos.dealId, deal.id))).toHaveLength(1);
  });

  it("Calificado → Agendado crea la cita", async () => {
    const deal = await nuevoDeal("calificado");
    await moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "agendado",
      hecho: { tipo: "agendado", fechaAgenda: new Date("2026-10-15T14:00:00Z") },
    });
    expect(await etapaDe(deal.id)).toBe("agendado");
    expect(await db.select().from(calls).where(eq(calls.dealId, deal.id))).toHaveLength(1);
  });

  it("un rechazo del motor deshace la llamada y el Show", async () => {
    const deal = await nuevoDeal("compromiso_verbal");
    await expect(moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "agendado",
      hecho: { tipo: "atendido", fechaAgenda: new Date("2026-10-15T14:00:00Z") },
    })).rejects.toThrow();
    expect(await etapaDe(deal.id)).toBe("compromiso_verbal");
    expect(await db.select().from(calls).where(eq(calls.dealId, deal.id))).toHaveLength(0);
  });

  it("un destino incompatible deshace el abono", async () => {
    const deal = await nuevoDeal("compromiso_verbal");
    await expect(moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "atendido",
      hecho: { tipo: "abono", fecha: "2026-10-09", monto: "250", moneda: "USD" },
    })).rejects.toThrow();
    expect(await etapaDe(deal.id)).toBe("compromiso_verbal");
    expect(await db.select().from(abonos).where(eq(abonos.dealId, deal.id))).toHaveLength(0);
  });

  it("rechaza con 422 una re-agenda sin comentario cuando el motivo pide texto", async () => {
    const deal = await nuevoDeal("atendido");
    const error = await moverConHecho(db, actor(), {
      dealId: deal.id,
      a: "atendido",
      pendiente: "reagenda",
      motivoId: motivoOtroId,
    }).catch((causa: unknown) => causa);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
  });
  it("una flecha que solo pone el pendiente en la misma etapa (PR2) sí pasa por el motor", async () => {
    const deal = await nuevoDeal("atendido");
    const motivoId = (await db.insert(motivos).values({ nombre: "Sin comunicación", tipo: "reagenda" }).returning())[0].id;
    await moverConHecho(db, actor(), { dealId: deal.id, a: "atendido", pendiente: "reagenda", motivoId });
    const [fila] = await db.select({ etapa: deals.etapa, pendiente: deals.pendiente }).from(deals).where(eq(deals.id, deal.id));
    expect(fila).toEqual({ etapa: "atendido", pendiente: "reagenda" });
  });
});
