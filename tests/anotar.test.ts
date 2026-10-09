import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  calls,
  cohorts,
  dealActividades,
  deals,
  leads,
  motivos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { anotar } from "@/lib/deals/anotar";
import { resumenDelCambio } from "@/lib/deals/resumen-del-cambio";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let cohorteDestinoId: string;
let closerId: string;
let motivoReagendaId: string;
let motivoQuePideTextoId: string;
let secuencia = 0;

const actor = () => ({ userId: closerId, rol: "closer" as const });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "anotar",
    nombre: "Anotar",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const [actual, destino] = await db.insert(cohorts).values([
    {
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    },
    {
      programId,
      codigo: "C2",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2027-02-01",
      fechaInicioVentas: "2027-01-01",
      fechaCierreVentas: "2027-01-31",
      estado: "futuro",
    },
  ]).returning();
  cohortId = actual.id;
  cohorteDestinoId = destino.id;
  closerId = (await db.insert(users).values({ email: "closer-anotar@retia.co", rol: "closer" }).returning())[0].id;
  const motivosCreados = await db.insert(motivos).values([
    { nombre: "No pudo asistir", tipo: "reagenda" },
    { nombre: "Otro", tipo: "reagenda", pideTexto: true },
  ]).returning();
  motivoReagendaId = motivosCreados[0].id;
  motivoQuePideTextoId = motivosCreados[1].id;
});

afterEach(async () => cerrar());

async function nuevoDeal(etapa: EtapaDeal) {
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `anotar-${secuencia++}@retia.co`,
  }).returning();
  return (await db.insert(deals).values({
    leadId: lead.id,
    programId,
    cohortId,
    ownerUserId: closerId,
    etapa,
  }).returning())[0];
}

async function llamadaAgendada(dealId: string) {
  return (await db.insert(calls).values({
    dealId,
    programId,
    cohortId,
    closerUserId: closerId,
    fechaAgenda: new Date("2026-10-10T15:00:00.000Z"),
    resultado: "agendada",
    origen: "crm",
  }).returning())[0];
}

describe("anotar", () => {
  it("rechaza con 422 una re-agenda sin comentario cuando el motivo pide texto", async () => {
    const deal = await nuevoDeal("atendido");
    const error = await anotar(db, actor(), {
      dealId: deal.id,
      reagenda: { motivoId: motivoQuePideTextoId },
    }).catch((causa: unknown) => causa);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(422);
    expect((error as Error).message).toBe("Este motivo pide que escribas el porqué.");
  });

  it("acepta y guarda el comentario cuando el motivo de re-agenda pide texto", async () => {
    const deal = await nuevoDeal("atendido");
    await anotar(db, actor(), {
      dealId: deal.id,
      comentario: "La razón no está en la lista",
      reagenda: { motivoId: motivoQuePideTextoId },
    });

    expect((await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id)))[0].nota)
      .toBe("La razón no está en la lista");
  });

  it("acepta una re-agenda sin comentario cuando el motivo no pide texto", async () => {
    const deal = await nuevoDeal("atendido");
    await anotar(db, actor(), { dealId: deal.id, reagenda: { motivoId: motivoReagendaId } });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].pendiente).toBe("reagenda");
  });

  it("con fecha deja Seguimiento y conserva el pendiente en la actividad", async () => {
    const deal = await nuevoDeal("atendido");
    const resultado = await anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Volver cuando confirme presupuesto",
      proximoContacto: "2026-10-12",
    });

    expect(resultado).toMatchObject({
      etapaAntes: "atendido",
      etapaDespues: "atendido",
      pendientePuesto: "seguimiento",
      fecha: "2026-10-12",
    });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      etapa: "atendido",
      pendiente: "seguimiento",
      fechaSeguimiento: "2026-10-12",
    });
    expect((await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id)))[0]).toMatchObject({
      tipo: "nota",
      nota: "Volver cuando confirme presupuesto",
      proximoContacto: "2026-10-12",
      pendientePuesto: "seguimiento",
    });
  });

  it("un comentario solo deja el resumen en «Anotación guardada.»", async () => {
    const deal = await nuevoDeal("atendido");
    const resultado = await anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Solo una nota, sin pendiente",
    });
    expect(resumenDelCambio(resultado.cambio)).toEqual(["Anotación guardada."]);
  });

  it("el próximo contacto deja una línea de Seguimiento con fecha", async () => {
    const deal = await nuevoDeal("atendido");
    const resultado = await anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Volver cuando confirme presupuesto",
      proximoContacto: "2026-10-12",
    });
    expect(resumenDelCambio(resultado.cambio).some((linea) => linea.startsWith("Quedó en Seguimiento hasta el"))).toBe(true);
  });

  it("con la opción de cohorte deja Próxima Cohorte y su destino", async () => {
    const deal = await nuevoDeal("contactado");
    await anotar(db, actor(), {
      dealId: deal.id,
      proximaCohorte: { cohorteDestinoId },
    });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      etapa: "contactado",
      pendiente: "proxima_cohorte",
      cohorteDestinoId,
    });
  });

  it("en Agendado sin fecha marca no-show y deja Re-agenda", async () => {
    const deal = await nuevoDeal("agendado");
    const llamada = await llamadaAgendada(deal.id);
    await anotar(db, actor(), { dealId: deal.id, reagenda: { motivoId: motivoReagendaId } });

    expect((await db.select().from(calls).where(eq(calls.id, llamada.id)))[0].resultado).toBe("no_show");
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].pendiente).toBe("reagenda");
  });

  it("en Agendado con fecha cierra la llamada vieja, guarda su motivo y crea otra sin pendiente", async () => {
    const deal = await nuevoDeal("agendado");
    const vieja = await llamadaAgendada(deal.id);
    const nuevaFecha = new Date("2026-10-15T14:00:00.000Z");
    await anotar(db, actor(), {
      dealId: deal.id,
      reagenda: { motivoId: motivoReagendaId, fechaLlamada: nuevaFecha },
    });

    const filas = await db.select().from(calls).where(eq(calls.dealId, deal.id));
    expect(filas.find((c) => c.id === vieja.id)).toMatchObject({ resultado: "reagendada", motivoId: motivoReagendaId });
    expect(filas.find((c) => c.id !== vieja.id)).toMatchObject({ resultado: "agendada", origen: "crm" });
    expect(filas.find((c) => c.id !== vieja.id)?.fechaAgenda?.getTime()).toBe(nuevaFecha.getTime());
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({ etapa: "agendado", pendiente: null });
  });

  it("en Atendido pone Re-agenda con motivo y, con fecha, crea la nueva llamada", async () => {
    const deal = await nuevoDeal("atendido");
    const nuevaFecha = new Date("2026-10-16T16:30:00.000Z");
    await anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Pidió otra hora",
      reagenda: { motivoId: motivoReagendaId, fechaLlamada: nuevaFecha },
    });

    expect((await db.select().from(calls).where(eq(calls.dealId, deal.id)))[0]).toMatchObject({
      resultado: "agendada",
      origen: "crm",
    });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({ etapa: "agendado", pendiente: null });
  });

  it("una anotación humana mueve Registrado a En gestión", async () => {
    const deal = await nuevoDeal("registrado");
    const resultado = await anotar(db, actor(), { dealId: deal.id, comentario: "Revisar el perfil" });
    expect(resultado.etapaDespues).toBe("en_gestion");
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].etapa).toBe("en_gestion");
  });

  it("una nota del sistema no cuenta como actividad comercial", async () => {
    const deal = await nuevoDeal("registrado");
    await db.insert(dealActividades).values({ dealId: deal.id, tipo: "nota", userId: null, nota: "Sistema" });
    await expect(moverEtapa(db, {
      dealId: deal.id,
      a: "en_gestion",
      actor: { tipo: "sistema" },
    })).rejects.toThrow("Falta registrar una actividad");
  });

  it("rechaza próximo contacto sin comentario y dos pendientes", async () => {
    const deal = await nuevoDeal("calificado");
    await expect(anotar(db, actor(), {
      dealId: deal.id,
      proximoContacto: "2026-10-12",
    })).rejects.toThrow("Escribe un comentario");
    await expect(anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Dos a la vez",
      proximoContacto: "2026-10-12",
      proximaCohorte: { cohorteDestinoId },
    })).rejects.toThrow("Una anotación solo puede dejar un pendiente");
  });

  it("rechaza una opción que la tabla de flechas no permite desde la etapa", async () => {
    const deal = await nuevoDeal("contactado");
    await expect(anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Intento forjado",
      proximoContacto: "2026-10-12",
    })).rejects.toThrow("no está permitido desde la etapa actual");
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id))).toHaveLength(0);
  });
});
