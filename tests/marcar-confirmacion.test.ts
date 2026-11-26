import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { marcarConfirmacion, marcarConfirmacionMasiva, marcarShow } from "@/lib/deals/llamadas";
import { deshacerEvento, eventosDeshacibles } from "@/lib/deshacer/deshacer";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let closerId: string;
let otroCloserId: string;
let secuencia = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  secuencia = 0;
  const [programa, otroPrograma] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "confirmacion", nombre: "Confirmación" },
    { ...PROGRAMA_DE_PRUEBA, slug: "confirmacion-otro", nombre: "Otro" },
  ]).returning();
  programId = programa.id;
  otroProgramId = otroPrograma.id;
  const [closer, otroCloser] = await db.insert(users).values([
    { email: "closer-confirmacion@retia.test", rol: "closer" },
    { email: "otro-confirmacion@retia.test", rol: "closer" },
  ]).returning();
  closerId = closer.id;
  otroCloserId = otroCloser.id;
  await db.insert(miembrosPrograma).values({ userId: closerId, programId });
});

const actor = (userId = closerId) => ({ userId, rol: "closer" as const, operaComoCloser: false });

async function caso(opciones: { programa?: string; owner?: string; anulada?: boolean } = {}) {
  secuencia += 1;
  const programa = opciones.programa ?? programId;
  const owner = opciones.owner ?? closerId;
  const [lead] = await db.insert(leads).values({
    programId: programa,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `confirmacion-${secuencia}@retia.test`,
  }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    ownerUserId: owner,
    etapa: "agendado",
  }).returning();
  const [call] = await db.insert(calls).values({
    programId: programa,
    dealId: deal.id,
    closerUserId: owner,
    emailLead: lead.emailNormalizado,
    fechaAgenda: new Date("2026-11-01T10:00:00-05:00"),
    resultado: "agendada",
    origen: "crm",
    ...(opciones.anulada
      ? { anuladoEn: new Date(), anuladoPor: owner, motivoAnulacion: "Duplicada" }
      : {}),
  }).returning();
  return { deal, call };
}

async function llamada(callId: string) {
  return (await db.select().from(calls).where(eq(calls.id, callId)))[0];
}

async function rechaza(promesa: Promise<unknown>) {
  try {
    await promesa;
    throw new Error("Se esperaba un rechazo");
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorDeApp);
    return error as ErrorDeApp;
  }
}

describe("marcarConfirmacion", () => {
  it("marca y limpia la confirmación con su fecha", async () => {
    const { call } = await caso();
    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: "confirmada" });
    expect(await llamada(call.id)).toMatchObject({ confirmacion: "confirmada", confirmacionEn: expect.any(Date) });

    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: null });
    expect(await llamada(call.id)).toMatchObject({ confirmacion: null, confirmacionEn: null });
  });

  it("repetir el mismo valor no escribe otra fila de rastro", async () => {
    const { call } = await caso();
    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: "confirmada" });
    const antes = await db.select().from(changeLog).where(eq(changeLog.registroId, call.id));
    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: "confirmada" });
    const despues = await db.select().from(changeLog).where(eq(changeLog.registroId, call.id));
    expect(despues).toEqual(antes);
  });

  it("rechaza una llamada anulada, una de otro programa no visible y un closer fuera de alcance", async () => {
    const anulada = await caso({ anulada: true });
    expect((await rechaza(marcarConfirmacion(db, actor(), { callId: anulada.call.id, confirmacion: "confirmada" }))).status).toBe(404);

    const otroPrograma = await caso({ programa: otroProgramId, owner: otroCloserId });
    expect((await rechaza(marcarConfirmacion(db, actor(), { callId: otroPrograma.call.id, confirmacion: "confirmada" }))).status).toBe(403);

    const fueraDeAlcance = await caso({ owner: otroCloserId });
    expect((await rechaza(marcarConfirmacion(db, actor(), { callId: fueraDeAlcance.call.id, confirmacion: "confirmada" }))).status).toBe(403);
  });

  it("marcar show conserva la confirmación", async () => {
    const { call } = await caso();
    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: "confirmada" });
    await marcarShow(db, actor(), { callId: call.id });
    expect(await llamada(call.id)).toMatchObject({ resultado: "show", confirmacion: "confirmada" });
  });

  it("la confirmación masiva marca solo llamadas agendadas visibles y reporta las omitidas", async () => {
    const agendada = await caso();
    const resuelta = await caso();
    await db.update(calls).set({ resultado: "show" }).where(eq(calls.id, resuelta.call.id));
    const fueraDeAlcance = await caso({ owner: otroCloserId });

    const resultado = await marcarConfirmacionMasiva(db, actor(), programId, [
      agendada.call.id,
      resuelta.call.id,
      fueraDeAlcance.call.id,
    ]);

    expect(resultado).toEqual({ marcadas: 1, omitidas: 2 });
    expect(await llamada(agendada.call.id)).toMatchObject({ confirmacion: "confirmada" });
    expect(await llamada(resuelta.call.id)).toMatchObject({ confirmacion: null });
    expect(await llamada(fueraDeAlcance.call.id)).toMatchObject({ confirmacion: null });
  });

  it("la acción masiva usa la sesión, el programa visible y devuelve sus conteos", async () => {
    const callId = "00000000-0000-4000-8000-000000000001";
    const session = { user: { id: closerId, rol: "closer", operaComoCloser: false } };
    const requireRole = vi.fn().mockResolvedValue(session);
    const rolDeVista = vi.fn().mockResolvedValue("closer");
    const programaVisiblePorSlug = vi.fn().mockResolvedValue({ id: programId });
    const marcarConfirmacionMasivaMock = vi.fn().mockResolvedValue({ marcadas: 1, omitidas: 2 });
    vi.doMock("@/lib/auth/guards", () => ({ requireRole }));
    vi.doMock("@/lib/auth/vista", () => ({ rolDeVista }));
    vi.doMock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug }));
    vi.doMock("@/lib/db", () => ({ db: { identificador: "db-prueba" } }));
    vi.doMock("@/lib/deals/llamadas", () => ({ marcarConfirmacionMasiva: marcarConfirmacionMasivaMock }));

    try {
      const { marcarConfirmacionMasivaAccion } = await import("@/app/(app)/p/[programa]/calls/acciones");
      const resultado = await marcarConfirmacionMasivaAccion({
        programaSlug: "confirmacion",
        callIds: [callId],
      });

      expect(resultado).toEqual({ ok: true, marcadas: 1, omitidas: 2 });
      expect(requireRole).toHaveBeenCalledWith("gerente", "closer");
      expect(programaVisiblePorSlug).toHaveBeenCalledWith(closerId, "closer", "confirmacion");
      expect(marcarConfirmacionMasivaMock).toHaveBeenCalledWith(
        { identificador: "db-prueba" },
        { userId: closerId, rol: "closer", operaComoCloser: false },
        programId,
        [callId],
      );
    } finally {
      vi.doUnmock("@/lib/auth/guards");
      vi.doUnmock("@/lib/auth/vista");
      vi.doUnmock("@/lib/auth/alcance");
      vi.doUnmock("@/lib/db");
      vi.doUnmock("@/lib/deals/llamadas");
      vi.resetModules();
    }
  });

  it("deshacer restaura el valor y la fecha anteriores", async () => {
    const { deal, call } = await caso();
    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: "confirmada" });
    const anterior = await llamada(call.id);
    await marcarConfirmacion(db, actor(), { callId: call.id, confirmacion: null });
    const evento = (await eventosDeshacibles(db, actor(), deal.id)).find((fila) =>
      fila.tabla === "calls" && fila.resumen.some((campo) => campo.campo === "confirmacion" && campo.ahora === null)
    );
    expect(evento?.puedeDeshacer).toBe(true);
    await deshacerEvento(db, actor(), {
      dealId: deal.id,
      evento: { tipo: "cambio", changeLogId: evento!.id },
    });
    expect(await llamada(call.id)).toMatchObject({
      confirmacion: "confirmada",
      confirmacionEn: anterior.confirmacionEn,
    });
    expect(await db.select().from(changeLog).where(and(
      eq(changeLog.registroId, call.id),
      eq(changeLog.campo, "confirmacion"),
    ))).toHaveLength(3);
  });
});
