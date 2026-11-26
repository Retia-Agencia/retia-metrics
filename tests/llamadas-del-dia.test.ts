import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { llamadasDelCloser, rangoDeMiDia } from "@/lib/mi-espacio/llamadas-del-dia";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let ownerId: string;
let otroOwnerId: string;
let secuencia = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  secuencia = 0;
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "mi-dia", nombre: "Mi día", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "mi-dia-otro", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  [programId, otroProgramId] = programas.map((programa) => programa.id);
  const owners = await db.insert(users).values([
    { email: "mi-dia@retia.test", rol: "closer" },
    { email: "mi-dia-otro@retia.test", rol: "closer" },
  ]).returning();
  [ownerId, otroOwnerId] = owners.map((owner) => owner.id);
});

async function crearLlamada(entrada: {
  programa?: string;
  owner?: string;
  fechaAgenda?: Date;
  fechaLlamada?: Date;
  confirmacion?: "confirmada" | "no_confirmada";
  callAnulada?: boolean;
  dealAnulado?: boolean;
}) {
  secuencia += 1;
  const programa = entrada.programa ?? programId;
  const owner = entrada.owner ?? ownerId;
  const [lead] = await db.insert(leads).values({
    programId: programa,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `mi-dia-${secuencia}@retia.test`,
    nombre: `Lead ${secuencia}`,
  }).returning();
  const anulacion = { anuladoEn: new Date(), anuladoPor: owner, motivoAnulacion: "Error" };
  const [deal] = await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    ownerUserId: owner,
    etapa: "agendado",
    ...(entrada.dealAnulado ? anulacion : {}),
  }).returning();
  return db.insert(calls).values({
    programId: programa,
    dealId: deal.id,
    fechaAgenda: entrada.fechaAgenda,
    fechaLlamada: entrada.fechaLlamada,
    confirmacion: entrada.confirmacion,
    resultado: "agendada",
    origen: "crm",
    ...(entrada.callAnulada ? anulacion : {}),
  }).returning().then(([call]) => call);
}

describe("rangoDeMiDia", () => {
  it("usa días de calendario de Bogotá para hoy, mañana y los próximos siete días", () => {
    expect(rangoDeMiDia("2026-12-30", "hoy")).toEqual({ desde: "2026-12-30", hasta: "2026-12-30" });
    expect(rangoDeMiDia("2026-12-30", "manana")).toEqual({ desde: "2026-12-31", hasta: "2026-12-31" });
    expect(rangoDeMiDia("2026-12-30", "semana")).toEqual({ desde: "2026-12-30", hasta: "2027-01-05" });
  });
});

describe("llamadasDelCloser", () => {
  it("ancla Calendly en fechaAgenda y limita por programa, dueño y vigencia", async () => {
    const porFechaLlamada = await crearLlamada({ fechaLlamada: new Date("2026-12-30T09:00:00-05:00") });
    const deCalendly = await crearLlamada({ fechaAgenda: new Date("2026-12-30T10:00:00-05:00") });
    await crearLlamada({ fechaAgenda: new Date("2026-12-31T10:00:00-05:00") });
    await crearLlamada({ fechaAgenda: new Date("2026-12-30T11:00:00-05:00"), owner: otroOwnerId });
    await crearLlamada({ fechaAgenda: new Date("2026-12-30T12:00:00-05:00"), programa: otroProgramId });
    await crearLlamada({ fechaAgenda: new Date("2026-12-30T13:00:00-05:00"), callAnulada: true });
    await crearLlamada({ fechaAgenda: new Date("2026-12-30T14:00:00-05:00"), dealAnulado: true });

    const filas = await llamadasDelCloser(db, {
      programId,
      userId: ownerId,
      rango: "hoy",
      hoy: "2026-12-30",
    });

    expect(filas.map((fila) => fila.callId)).toEqual([porFechaLlamada.id, deCalendly.id]);
    expect(filas[1]).toMatchObject({
      dealId: expect.any(String),
      leadNombre: "Lead 2",
      leadEmail: "mi-dia-2@retia.test",
      hora: new Date("2026-12-30T10:00:00-05:00"),
    });
  });

  it("el filtro sin confirmar conserva valores no confirmados y excluye confirmada", async () => {
    const vacia = await crearLlamada({ fechaAgenda: new Date("2026-12-30T09:00:00-05:00") });
    const noConfirmada = await crearLlamada({
      fechaAgenda: new Date("2026-12-30T10:00:00-05:00"),
      confirmacion: "no_confirmada",
    });
    await crearLlamada({ fechaAgenda: new Date("2026-12-30T11:00:00-05:00"), confirmacion: "confirmada" });

    const filas = await llamadasDelCloser(db, {
      programId,
      userId: ownerId,
      rango: "hoy",
      hoy: "2026-12-30",
      soloSinConfirmar: true,
    });

    expect(filas.map((fila) => fila.callId)).toEqual([vacia.id, noConfirmada.id]);
  });
});
