import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, dealActividades, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { transicion, type EtapaDeal } from "@/lib/deals/etapas";
import { MovimientoRechazado, moverEtapa } from "@/lib/deals/mover-etapa";
import { alertasDelDeal } from "@/lib/queries/ficha-deal";
import { inboxDelPrograma } from "@/lib/queries/inbox";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let closer: string;
let secuencia = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "p",
    nombre: "P",
    ticketUsd: "1000",
    diasSinActividad: 3,
  }).returning();
  programId = programa.id;
  const [otro] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "q",
    nombre: "Q",
    ticketUsd: "800",
  }).returning();
  otroProgramId = otro.id;
  const [usuario] = await db.insert(users).values({
    email: "closer@retia.test",
    nombre: "Closer",
    rol: "closer",
    closerId: "Closer",
  }).returning();
  closer = usuario.id;
});

afterEach(async () => {
  await cerrar();
});

async function crearDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  secuencia += 1;
  const programa = extra.programId ?? programId;
  const [lead] = await db.insert(leads).values({
    programId: programa,
    emailNormalizado: `persona-${secuencia}@retia.test`,
    nombre: `Persona ${secuencia}`,
  }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    programId: programa,
    etapa,
    ownerUserId: closer,
    ...extra,
  }).returning();
  return deal.id;
}

const actorPara = (etapa: EtapaDeal, destino: EtapaDeal) => transicion(etapa, destino)?.quien === "closer"
  ? { tipo: "usuario" as const, userId: closer, rol: "closer" as const }
  : { tipo: "sistema" as const };

async function rechazoDe(dealId: string, etapa: EtapaDeal, destino: EtapaDeal) {
  try {
    await moverEtapa(db, { dealId, a: destino, actor: actorPara(etapa, destino) });
  } catch (error) {
    expect(error).toBeInstanceOf(MovimientoRechazado);
    return error as MovimientoRechazado;
  }
  throw new Error("Se esperaba que moverEtapa rechazara el movimiento.");
}

async function preparar(etapa: EtapaDeal, listo: boolean) {
  const dealId = await crearDeal(etapa);
  if (listo && (etapa === "en_gestion" || etapa === "contactado")) {
    await db.insert(dealActividades).values({
      dealId,
      tipo: "contacto",
      canal: "whatsapp",
      userId: closer,
    });
  }
  if (etapa === "agendado") {
    await db.insert(calls).values({
      dealId,
      programId,
      resultado: listo ? "show" : "agendada",
      fechaAgenda: new Date("2026-10-03T10:00:00-05:00"),
      origen: "app",
    });
  }
  return dealId;
}

describe("alertasDelDeal — requisitos del camino feliz", () => {
  for (const etapa of ["en_gestion", "contactado", "agendado"] as const) {
    it(`${etapa}: la primera ruta visible muestra exactamente lo que rechaza moverEtapa`, async () => {
      const incompleto = await preparar(etapa, false);
      const alerta = await alertasDelDeal(db, programId, incompleto);
      const ruta = alerta!.paraAvanzar[0];
      expect(transicion(etapa, ruta.destino)?.quien).not.toBe("sistema");

      const rechazo = await rechazoDe(incompleto, etapa, ruta.destino);
      expect(ruta.faltan.map((f) => f.codigo)).toEqual(
        rechazo.faltantes.filter((f) => f.codigo !== "motivo").map((f) => f.codigo),
      );

      const listo = await preparar(etapa, true);
      const alertaLista = await alertasDelDeal(db, programId, listo);
      const rutaLista = alertaLista!.paraAvanzar[0];
      expect(rutaLista.faltan).toEqual([]);
      await expect(moverEtapa(db, {
        dealId: listo,
        a: rutaLista.destino,
        actor: actorPara(etapa, rutaLista.destino),
      })).resolves.toMatchObject({ de: etapa, a: rutaLista.destino });
    });
  }
});

describe("alertasDelDeal — urgencia y fronteras", () => {
  it("Ganado Pago Parcial no ofrece rutas que mueve el sistema", async () => {
    const dealId = await crearDeal("ganado_parcial");

    const alerta = (await alertasDelDeal(db, programId, dealId))!;

    expect(alerta.paraAvanzar.map((ruta) => ruta.destino)).toEqual(["cierre_perdido"]);
  });

  it("marca como urgente una llamada atendida vigente sin link de Grain", async () => {
    const dealId = await crearDeal("atendido");
    await db.insert(calls).values({
      dealId,
      programId,
      resultado: "show",
      linkGrain: " ",
      origen: "app",
    });

    expect((await alertasDelDeal(db, programId, dealId))!.urgentes).toContainEqual({
      motivo: "atendida_sin_grain",
      mensaje: "La llamada atendida no tiene el link de Grain.",
    });
  });

  it("refleja en ambos sentidos los motivos de atención del Inbox", async () => {
    const urgente = await crearDeal("contactado", { createdAt: new Date("2026-09-01T12:00:00-05:00") });
    const reciente = await crearDeal("contactado", { createdAt: new Date() });
    await db.insert(dealActividades).values({
      dealId: reciente,
      tipo: "contacto",
      canal: "whatsapp",
      userId: closer,
      fecha: new Date(),
    });

    const inbox = await inboxDelPrograma(db, programId, "equipo");
    const motivo = inbox.atencion.find((fila) => fila.dealId === urgente)?.motivo;
    expect(motivo).toBeDefined();
    expect((await alertasDelDeal(db, programId, urgente))!.urgentes.map((a) => a.motivo)).toContain(motivo);
    expect(inbox.atencion.some((fila) => fila.dealId === reciente)).toBe(false);
    expect((await alertasDelDeal(db, programId, reciente))!.urgentes).toEqual([]);
  });

  it("solo muestra el aviso amarillo en En gestión", async () => {
    const enGestion = await crearDeal("en_gestion");
    const contactado = await crearDeal("contactado");
    expect((await alertasDelDeal(db, programId, enGestion))!.aviso)
      .toBe("Para registrar un pago, primero marca el contacto como logrado.");
    expect((await alertasDelDeal(db, programId, contactado))!.aviso).toBeNull();
  });

  it("devuelve null para anulados, cerrados y deals de otro programa", async () => {
    const anulado = await crearDeal("contactado", {
      anuladoEn: new Date(),
      anuladoPor: closer,
      motivoAnulacion: "Duplicado",
    });
    const ganado = await crearDeal("ganado_completo");
    const perdido = await crearDeal("cierre_perdido");
    const ajeno = await crearDeal("contactado", { programId: otroProgramId });

    await expect(alertasDelDeal(db, programId, anulado)).resolves.toBeNull();
    await expect(alertasDelDeal(db, programId, ganado)).resolves.toBeNull();
    await expect(alertasDelDeal(db, programId, perdido)).resolves.toBeNull();
    await expect(alertasDelDeal(db, programId, ajeno)).resolves.toBeNull();
  });
});
