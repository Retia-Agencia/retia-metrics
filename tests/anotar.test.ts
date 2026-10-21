import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { anotar, esquemaAnotar } from "@/lib/deals/anotar";
import { resumenDelCambio } from "@/lib/deals/resumen-del-cambio";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { ErrorDeApp } from "@/lib/errors";
import { ventasPorCohorte } from "@/lib/queries/dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let cohorteDestinoId: string;
let closerId: string;
let motivoReagendaId: string;
let motivoQuePideTextoId: string;
let secuencia = 0;

const actor = () => ({ userId: closerId, rol: "closer" as const, operaComoCloser: false });

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
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

afterAll(async () => cerrar());

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

  it("Próxima cohorte cambia cohort_id ya, conserva etapa y deja rastro, nota y aviso", async () => {
    const deal = await nuevoDeal("contactado");
    const resultado = await anotar(db, actor(), {
      dealId: deal.id,
      proximaCohorte: { cohorteDestinoId },
    });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      etapa: "contactado",
      cohortId: cohorteDestinoId,
      pendiente: null,
      cohorteDestinoId: null,
    });
    expect(resumenDelCambio(resultado.cambio)).toEqual(["Cohorte cambiada: C1 → C2."]);
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, deal.id))).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: "cohortId", valorAnterior: cohortId, valorNuevo: cohorteDestinoId })]),
    );
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id))).toEqual([
      expect.objectContaining({
        userId: null,
        nota: "Cohorte cambiada por Próxima cohorte: C1 → C2. El deal ya cuenta en C2.",
      }),
    ]);
  });

  it("Próxima cohorte rechaza una cohorte no futura o de otro programa", async () => {
    const deal = await nuevoDeal("contactado");
    await expect(anotar(db, actor(), {
      dealId: deal.id,
      proximaCohorte: { cohorteDestinoId: cohortId },
    })).rejects.toThrow("distinta a la actual");

    const [programaAjeno] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "anotar-ajeno",
      nombre: "Anotar ajeno",
      ticketUsd: "1500",
    }).returning();
    const [ajena] = await db.insert(cohorts).values({
      programId: programaAjeno.id,
      codigo: "A1",
      metaCupos: 10,
      precioUsd: "1500",
      estado: "futuro",
    }).returning();
    await expect(anotar(db, actor(), {
      dealId: deal.id,
      proximaCohorte: { cohorteDestinoId: ajena.id },
    })).rejects.toThrow("otro programa");

    const [activaDistinta] = await db.insert(cohorts).values({
      programId,
      codigo: "C0",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-08-01",
      fechaInicioVentas: "2026-07-01",
      fechaCierreVentas: "2026-07-31",
      estado: "cerrado",
    }).returning();
    await expect(anotar(db, actor(), {
      dealId: deal.id,
      proximaCohorte: { cohorteDestinoId: activaDistinta.id },
    })).rejects.toThrow("solo admite una cohorte futura");
  });

  it("las métricas de cohorte cuentan la venta solo en la cohorte nueva", async () => {
    const deal = await nuevoDeal("contactado");
    await anotar(db, actor(), { dealId: deal.id, proximaCohorte: { cohorteDestinoId } });
    await db.update(deals).set({ etapa: "ganado_parcial" }).where(eq(deals.id, deal.id));
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: "contactado", a: "ganado_parcial" });

    const metricas = await ventasPorCohorte({
      programId,
      rango: { desde: "2020-01-01", hasta: "2099-12-31" },
    }, db);
    expect(metricas.find((fila) => fila.cohorteId === cohortId)?.ventas ?? 0).toBe(0);
    expect(metricas.find((fila) => fila.cohorteId === cohorteDestinoId)?.ventas).toBe(1);
  });

  it("con cita viva rechaza la reagenda con 409 y no mueve nada", async () => {
    const deal = await nuevoDeal("agendado");
    const llamada = await llamadaAgendada(deal.id);
    const error = await anotar(db, actor(), { dealId: deal.id, reagenda: { motivoId: motivoReagendaId } }).catch((e) => e as ErrorDeApp);

    expect(error).toMatchObject({ status: 409, message: "Esta cita se resuelve desde Resultado, en la llamada." });
    expect((await db.select().from(calls).where(eq(calls.id, llamada.id)))[0].resultado).toBe("agendada");
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].pendiente).toBeNull();
  });

  it("sin cita viva deja Re-agenda con motivo y el esquema rechaza fechaLlamada", async () => {
    const deal = await nuevoDeal("atendido");
    await anotar(db, actor(), {
      dealId: deal.id,
      comentario: "Pidió otra hora",
      reagenda: { motivoId: motivoReagendaId },
    });

    expect(await db.select().from(calls).where(eq(calls.dealId, deal.id))).toHaveLength(0);
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({ etapa: "atendido", pendiente: "reagenda", motivoId: motivoReagendaId });
    expect(esquemaAnotar.safeParse({ dealId: deal.id, reagenda: { motivoId: motivoReagendaId, fechaLlamada: new Date() } }).success).toBe(false);
  });

  it("anotar NUNCA mueve: un deal en Registrado o Potencial se queda donde está (ticket 228)", async () => {
    const registrado = await nuevoDeal("registrado");
    const r1 = await anotar(db, actor(), { dealId: registrado.id, comentario: "Revisar el perfil" });
    expect(r1.etapaDespues).toBe("registrado");
    expect((await db.select().from(deals).where(eq(deals.id, registrado.id)))[0].etapa).toBe("registrado");

    const potencial = await nuevoDeal("potencial");
    const r2 = await anotar(db, actor(), { dealId: potencial.id, comentario: "Lo llamo mañana" });
    expect(r2.etapaDespues).toBe("potencial");
    expect((await db.select().from(deals).where(eq(deals.id, potencial.id)))[0].etapa).toBe("potencial");

    // Tampoco mueve de etapa cuando cambia a Próxima Cohorte.
    const conPendiente = await nuevoDeal("potencial");
    const r3 = await anotar(db, actor(), {
      dealId: conPendiente.id,
      comentario: "Quiere la próxima",
      proximaCohorte: { cohorteDestinoId },
    });
    expect(r3.etapaDespues).toBe("potencial");
    const filaCambiada = (await db.select().from(deals).where(eq(deals.id, conPendiente.id)))[0];
    expect(filaCambiada.etapa).toBe("potencial");
    expect(filaCambiada).toMatchObject({ cohortId: cohorteDestinoId, pendiente: null, cohorteDestinoId: null });
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
