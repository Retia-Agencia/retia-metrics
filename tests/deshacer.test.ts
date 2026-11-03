import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { abonos, archivos, calls, changeLog, cohorts, dealActividades, dealEtapaHistorial, deals, leads, miembrosPrograma, programs, reversiones, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { deshacerEvento, eventosDeshacibles } from "@/lib/deshacer/deshacer";
import { ErrorDeApp } from "@/lib/errors";
import { vigente } from "@/lib/queries/vigente";
import { REGISTRO } from "@/lib/deshacer/registro";
import { leerHechos } from "@/lib/deals/mover-etapa";
import { cambiarDuenoDeal } from "@/lib/deals/cambiar-dueno";
import { ventasConDiaEn } from "@/lib/queries/dashboard";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let leadId: string;
let autor: string;
let dueno: string;
let ajeno: string;
let gerente: string;
let developer: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "deshacer", nombre: "Deshacer", ticketUsd: "1000" }).returning();
  programId = programa.id;
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@correo.co" }).returning();
  leadId = lead.id;
  const filas = await db.insert(users).values([
    { email: "autor@retia.co", rol: "closer" },
    { email: "dueno@retia.co", rol: "closer" },
    { email: "ajeno@retia.co", rol: "closer" },
    { email: "gerente@retia.co", rol: "gerente" },
    { email: "developer@retia.co", rol: "developer" },
  ]).returning();
  [autor, dueno, ajeno, gerente, developer] = filas.map((fila) => fila.id);
});
afterAll(async () => cerrar());

const actor = (userId: string, rol: "closer" | "gerente" | "developer" = "closer") => ({ userId, rol, operaComoCloser: false });

async function deal(ownerUserId: string | null = autor): Promise<string> {
  return crearConRastro(
    { db, tabla: deals, nombreTabla: "deals", actorId: autor, etiqueta: "Lead", desdeElMotor: true },
    { leadId, programId, ownerUserId, etapa: "en_gestion" },
  );
}

async function evento(tabla: string, registroId: string, campo: string): Promise<string> {
  const [fila] = await db.select({ id: changeLog.id }).from(changeLog)
    .where(and(eq(changeLog.tabla, tabla), eq(changeLog.registroId, registroId), eq(changeLog.campo, campo)));
  return fila.id;
}

async function eventoEditado(tabla: string, registroId: string, campo: string): Promise<string> {
  const filas = await db.select({ id: changeLog.id, anterior: changeLog.valorAnterior }).from(changeLog)
    .where(and(eq(changeLog.tabla, tabla), eq(changeLog.registroId, registroId), eq(changeLog.campo, campo)));
  const fila = filas.find((cambio) => cambio.anterior !== null);
  if (!fila) throw new Error("No existe el cambio editado esperado.");
  return fila.id;
}

async function error(p: Promise<unknown>): Promise<ErrorDeApp> {
  try { await p; } catch (e) { return e as ErrorDeApp; }
  throw new Error("Se esperaba ErrorDeApp");
}

describe("deshacer cambios", () => {
  it("el registro clasifica exhaustivamente cada columna en uno y solo un sentido", () => {
    for (const reglas of Object.values(REGISTRO)) {
      for (const regla of Object.values(reglas)) {
        expect(("restaurar" in regla) !== ("no" in regla)).toBe(true);
      }
    }
  });

  it("la creación es un solo grupo deshacible con id mínimo y resumen estructurado", async () => {
    const dealId = await deal();
    const filas = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    const esperado = filas.map((fila) => fila.id).sort((a, b) => a.localeCompare(b))[0];
    const eventos = await eventosDeshacibles(db, actor(autor), dealId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ id: esperado, puedeDeshacer: true });
    expect(eventos[0].resumen).toEqual(expect.arrayContaining([
      { campo: "leadId", ahora: leadId, quedaria: null },
      { campo: "programId", ahora: programId, quedaria: null },
    ]));
  });

  it("el cambio de dueño y su marca del sistema forman un grupo y se restauran por dominio", async () => {
    const dealId = await deal(autor);
    await cambiarDuenoDeal(db, {
      dealId, ownerActual: autor, ownerNuevo: dueno, actorId: autor, etiqueta: "Lead",
    });
    const eventos = await eventosDeshacibles(db, actor(autor), dealId);
    const cambio = eventos.find((evento) => evento.resumen.some((campo) => campo.campo === "ownerUserId"));
    expect(cambio?.resumen.map((campo) => campo.campo).sort()).toEqual(["ownerNovedadEn", "ownerUserId"]);
    expect(cambio?.puedeDeshacer).toBe(true);
    await deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId: cambio!.id } });
    expect((await db.select({ owner: deals.ownerUserId, novedad: deals.ownerNovedadEn }).from(deals).where(eq(deals.id, dealId)))[0])
      .toEqual({ owner: autor, novedad: null });
  });

  it("corregir etapa sin fila rechaza al closer ajeno sin mover la base", async () => {
    const dealId = await deal(dueno);
    await db.insert(miembrosPrograma).values({ userId: ajeno, programId });
    const antes = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
    const e = await error(deshacerEvento(db, actor(ajeno), {
      dealId,
      evento: { tipo: "etapa", id: null, a: "registrado" },
    }));
    expect(e.status).toBe(403);
    expect((await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("en_gestion");
    expect(await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId))).toEqual(antes);
  });

  it("restaura un cambio viejo, guarda motivo vacío como null y solo permite una vez", async () => {
    const dealId = await deal(dueno);
    await editarConRastro({ db, tabla: deals, nombreTabla: "deals", actorId: autor, etiqueta: "Lead" }, dealId, { acuerdoPago: "Primero" });
    const changeLogId = await evento("deals", dealId, "acuerdoPago");
    await editarConRastro({ db, tabla: deals, nombreTabla: "deals", actorId: dueno, etiqueta: "Lead" }, dealId, { acuerdoPago: "Después" });

    expect((await error(deshacerEvento(db, actor(ajeno), { dealId, evento: { tipo: "cambio", changeLogId } }))).status).toBe(403);
    expect((await db.select({ valor: deals.acuerdoPago }).from(deals).where(eq(deals.id, dealId)))[0].valor).toBe("Después");
    await deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId }, motivo: "   " });
    expect((await db.select({ valor: deals.acuerdoPago }).from(deals).where(eq(deals.id, dealId)))[0].valor).toBeNull();
    expect((await db.select({ motivo: reversiones.motivo }).from(reversiones))[0].motivo).toBeNull();
    const [filaDeReversion] = await db.select({ id: changeLog.id }).from(changeLog).where(eq(changeLog.reversionId, (await db.select({ id: reversiones.id }).from(reversiones))[0].id));
    expect((await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId: filaDeReversion.id } }))).status).toBe(409);
    const repetido = await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } }));
    expect(repetido.status).toBe(409);
    expect(repetido.message).toBe("Esto ya se deshizo.");
  });

  it.each([
    ["autor", () => actor(autor)], ["dueño", () => actor(dueno)],
    ["gerente", () => actor(gerente, "gerente")], ["developer", () => actor(developer, "developer")],
  ])("%s puede deshacer", async (_nombre, quien) => {
    const dealId = await deal(dueno);
    await editarConRastro({ db, tabla: deals, nombreTabla: "deals", actorId: autor, etiqueta: "Lead" }, dealId, { acuerdoPago: "Dos cuotas" });
    await deshacerEvento(db, quien(), { dealId, evento: { tipo: "cambio", changeLogId: await evento("deals", dealId, "acuerdoPago") } });
    expect((await db.select({ valor: deals.acuerdoPago }).from(deals).where(eq(deals.id, dealId)))[0].valor).toBeNull();
  });

  it("una actividad creada se anula y deja de estar vigente", async () => {
    const dealId = await deal();
    const actividadId = await crearConRastro(
      { db, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: autor, etiqueta: "Lead" },
      { dealId, tipo: "contacto", userId: autor, nota: "Contestó" },
    );
    await deshacerEvento(db, actor(autor), {
      dealId,
      evento: { tipo: "cambio", changeLogId: await evento("deal_actividades", actividadId, "dealId") },
    });
    expect(await db.select().from(dealActividades).where(and(eq(dealActividades.id, actividadId), vigente(dealActividades)))).toHaveLength(0);
    const [filaDeal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect((await leerHechos(db, filaDeal, null, null)).tieneContactoRegistrado).toBe(false);
  });

  it("una llamada de Calendly asignada vuelve a sueltas y una llamada CRM creada se anula", async () => {
    const dealId = await deal();
    const sueltaId = await crearConRastro(
      { db, tabla: calls, nombreTabla: "calls", actorId: null, etiqueta: "Lead" },
      { programId, origen: "calendly", emailLead: "lead@correo.co" },
    );
    await editarConRastro({ db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" }, sueltaId, { dealId });
    await deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId: await evento("calls", sueltaId, "dealId") } });
    expect((await db.select({ dealId: calls.dealId }).from(calls).where(eq(calls.id, sueltaId)))[0].dealId).toBeNull();

    const crm = await crearConRastro(
      { db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, origen: "crm", resultado: "agendada", closerUserId: autor },
    );
    await deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId: await evento("calls", crm, "dealId") } });
    expect(await db.select().from(calls).where(and(eq(calls.id, crm), vigente(calls)))).toHaveLength(0);
  });

  it("corrige libremente la etapa y solo recupera el pendiente al volver al origen", async () => {
    const dealId = await deal();
    await db.update(deals).set({ etapa: "calificado" }).where(eq(deals.id, dealId));
    const [historia] = await db.insert(dealEtapaHistorial).values({
      dealId, de: "contactado", a: "calificado", pendienteDe: "seguimiento", pendienteA: null, userId: autor,
    }).returning();
    await deshacerEvento(db, actor(autor), {
      dealId,
      evento: { tipo: "etapa", id: historia.id, a: "registrado" },
    });
    expect((await db.select({ etapa: deals.etapa, pendiente: deals.pendiente }).from(deals).where(eq(deals.id, dealId)))[0])
      .toEqual({ etapa: "registrado", pendiente: null });

    await db.update(deals).set({ etapa: "cierre_perdido" }).where(eq(deals.id, dealId));
    const otro = await deal();
    await db.update(deals).set({ etapa: "calificado" }).where(eq(deals.id, otro));
    const [historia2] = await db.insert(dealEtapaHistorial).values({
      dealId: otro, de: "contactado", a: "calificado", pendienteDe: "seguimiento", pendienteA: null, userId: autor,
    }).returning();
    await deshacerEvento(db, actor(autor), { dealId: otro, evento: { tipo: "etapa", id: historia2.id, a: "contactado" } });
    expect((await db.select({ pendiente: deals.pendiente }).from(deals).where(eq(deals.id, otro)))[0].pendiente).toBe("seguimiento");
  });

  it.each(["ganado_parcial", "ganado_completo", "cierre_perdido"] as const)("no corrige desde %s", async (etapa) => {
    const dealId = await deal();
    await db.update(deals).set({ etapa }).where(eq(deals.id, dealId));
    const e = await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "etapa", id: null, a: "contactado" } }));
    expect(e.status).toBe(409);
    expect((await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe(etapa);
  });

  it("deshacer una cortesía restaura el valor y saca el deal de Completo", async () => {
    const dealId = await deal(gerente);
    await db.update(deals).set({ etapa: "ganado_completo", valorVendidoUsd: "1000" }).where(eq(deals.id, dealId));
    await db.insert(dealEtapaHistorial).values({ dealId, de: "contactado", a: "ganado_completo", userId: gerente });
    await editarConRastro(
      { db, tabla: deals, nombreTabla: "deals", actorId: gerente, etiqueta: "Lead" },
      dealId,
      { cortesia: true, valorVendidoUsd: "0" },
    );
    await deshacerEvento(db, actor(gerente, "gerente"), {
      dealId,
      evento: { tipo: "cambio", changeLogId: await evento("deals", dealId, "cortesia") },
    });
    expect((await db.select({ etapa: deals.etapa, cortesia: deals.cortesia, valor: deals.valorVendidoUsd }).from(deals).where(eq(deals.id, dealId)))[0])
      .toEqual({ etapa: "contactado", cortesia: false, valor: "1000.00" });
    expect(await ventasConDiaEn(db, { desde: "2026-01-01", hasta: "2026-12-31" })).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ dealId })]),
    );
  });

  it("el valor vendido de una venta no se ofrece ni se restaura fuera de una cortesía", async () => {
    const dealId = await deal();
    await db.update(deals).set({ etapa: "ganado_parcial", valorVendidoUsd: "1000" }).where(eq(deals.id, dealId));
    await editarConRastro({ db, tabla: deals, nombreTabla: "deals", actorId: autor, etiqueta: "Lead" }, dealId, { valorVendidoUsd: "900" });
    const changeLogId = await eventoEditado("deals", dealId, "valorVendidoUsd");
    expect((await eventosDeshacibles(db, actor(autor), dealId)).find((evento) => evento.id === changeLogId)?.puedeDeshacer).toBe(false);
    const e = await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } }));
    expect(e).toMatchObject({ status: 409, message: "El valor vendido de una venta no se restaura en crudo." });
    expect((await db.select({ valor: deals.valorVendidoUsd }).from(deals).where(eq(deals.id, dealId)))[0].valor).toBe("900.00");
  });

  it("deshacer la creación de un abono lo anula y recalcula la etapa", async () => {
    const dealId = await deal();
    await db.update(deals).set({ etapa: "ganado_parcial", valorVendidoUsd: "1000" }).where(eq(deals.id, dealId));
    await db.insert(dealEtapaHistorial).values({ dealId, de: "atendido", a: "ganado_parcial", userId: autor });
    const abonoId = await crearConRastro(
      { db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, fecha: "2026-11-03", monto: "300", moneda: "USD", registradoPorUserId: autor, origen: "app", concepto: "ticket" },
    );
    await deshacerEvento(db, actor(autor), {
      dealId,
      evento: { tipo: "cambio", changeLogId: await evento("abonos", abonoId, "dealId") },
    });
    expect(await db.select().from(abonos).where(and(eq(abonos.id, abonoId), vigente(abonos)))).toHaveLength(0);
    expect((await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("atendido");
  });

  it("un campo contable del abono no se ofrece ni se restaura en crudo", async () => {
    const dealId = await deal();
    const abonoId = await crearConRastro(
      { db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, fecha: "2026-11-03", monto: "300", moneda: "USD", registradoPorUserId: autor, concepto: "ticket" },
    );
    await editarConRastro({ db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" }, abonoId, { monto: "400" });
    const changeLogId = await eventoEditado("abonos", abonoId, "monto");
    const ofrecido = (await eventosDeshacibles(db, actor(autor), dealId)).find((evento) => evento.id === changeLogId);
    expect(ofrecido?.puedeDeshacer).toBe(false);
    const e = await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } }));
    expect(e).toMatchObject({ status: 409, message: "Un pago mal registrado se deshace anulando el abono." });
    expect((await db.select({ monto: abonos.monto }).from(abonos).where(eq(abonos.id, abonoId)))[0].monto).toBe("400.00");
  });

  it("Calendly no restaura su hora; una llamada CRM sí", async () => {
    const dealId = await deal();
    const anterior = new Date("2026-11-05T15:00:00Z");
    const nueva = new Date("2026-11-06T15:00:00Z");
    for (const origen of ["calendly", "crm"] as const) {
      const callId = await crearConRastro(
        { db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" },
        { dealId, programId, origen, resultado: "agendada", fechaAgenda: anterior },
      );
      await editarConRastro({ db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" }, callId, { fechaAgenda: nueva });
      const changeLogId = await eventoEditado("calls", callId, "fechaAgenda");
      const eventoVisible = (await eventosDeshacibles(db, actor(autor), dealId)).find((evento) => evento.id === changeLogId);
      expect(eventoVisible?.puedeDeshacer).toBe(origen === "crm");
      if (origen === "calendly") {
        expect((await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } }))).message)
          .toBe("La hora de la cita la manda Calendly; se reagenda.");
      } else {
        await deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } });
        expect((await db.select({ fecha: calls.fechaAgenda }).from(calls).where(eq(calls.id, callId)))[0].fecha).toEqual(anterior);
      }
    }
  });

  it("restaura resultados corregibles por el dominio y rechaza un resultado actual no corregible", async () => {
    const dealId = await deal();
    const callId = await crearConRastro(
      { db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, origen: "crm", resultado: "show", fechaAgenda: new Date("2026-11-01T15:00:00Z"), closerUserId: autor },
    );
    await editarConRastro({ db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" }, callId, { resultado: "no_show" });
    await deshacerEvento(db, actor(autor), {
      dealId,
      evento: { tipo: "cambio", changeLogId: await eventoEditado("calls", callId, "resultado") },
      motivo: "Resultado equivocado",
    });
    expect((await db.select({ resultado: calls.resultado }).from(calls).where(eq(calls.id, callId)))[0].resultado).toBe("show");

    const otro = await crearConRastro(
      { db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, origen: "crm", resultado: "show", closerUserId: autor },
    );
    await editarConRastro({ db, tabla: calls, nombreTabla: "calls", actorId: autor, etiqueta: "Lead" }, otro, { resultado: "agendada" });
    const changeLogId = await eventoEditado("calls", otro, "resultado");
    expect((await eventosDeshacibles(db, actor(autor), dealId)).find((evento) => evento.id === changeLogId)?.puedeDeshacer).toBe(false);
    expect((await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } }))).status).toBe(409);
  });

  it("un choque de otro índice único no se traduce como evento ya deshecho", async () => {
    const dealId = await deal();
    const archivoId = crypto.randomUUID();
    await db.insert(archivos).values({
      id: archivoId, programId, ruta: `${archivoId}.png`, tipoMime: "image/png", bytes: 8,
      estado: "listo", subidoPorUserId: autor,
    });
    const primero = await crearConRastro(
      { db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, fecha: "2026-11-03", monto: "100", moneda: "USD", registradoPorUserId: autor, concepto: "adicional" },
    );
    await editarConRastro({ db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" }, primero, { comprobanteArchivoId: archivoId });
    await editarConRastro({ db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" }, primero, { comprobanteArchivoId: null });
    await crearConRastro(
      { db, tabla: abonos, nombreTabla: "abonos", actorId: autor, etiqueta: "Lead" },
      { dealId, programId, fecha: "2026-11-03", monto: "50", moneda: "USD", registradoPorUserId: autor, concepto: "adicional", comprobanteArchivoId: archivoId },
    );
    const filas = await db.select().from(changeLog).where(and(
      eq(changeLog.registroId, primero), eq(changeLog.campo, "comprobanteArchivoId"),
    ));
    const cambio = filas.find((fila) => fila.valorAnterior === archivoId && fila.valorNuevo === null)!;
    const e = await error(deshacerEvento(db, actor(autor), {
      dealId,
      evento: { tipo: "cambio", changeLogId: cambio.id },
    }));
    expect(e.message).not.toBe("Esto ya se deshizo.");
    expect(e).not.toBeInstanceOf(ErrorDeApp);
    expect(await db.select().from(reversiones).where(eq(reversiones.eventoId, cambio.id))).toHaveLength(0);
  });

  it("restaura la cohorte por el dominio y deja todas sus escrituras ligadas a la reversión", async () => {
    const [activa, futura] = await db.insert(cohorts).values([
      {
        programId, codigo: "ACT", metaCupos: 10, precioUsd: "1000", estado: "activo",
        fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-15",
      },
      {
        programId, codigo: "FUT", metaCupos: 10, precioUsd: "1000", estado: "futuro",
        fechaInicioVentas: "2026-12-01", fechaCierreVentas: "2027-01-15", fechaInicioClases: "2027-02-01",
      },
    ]).returning();
    const dealId = await deal();
    await db.update(deals).set({ cohortId: activa.id }).where(eq(deals.id, dealId));
    await editarConRastro({ db, tabla: deals, nombreTabla: "deals", actorId: autor, etiqueta: "Lead" }, dealId, { cohortId: futura.id });
    await deshacerEvento(db, actor(autor), {
      dealId,
      evento: { tipo: "cambio", changeLogId: await eventoEditado("deals", dealId, "cohortId") },
      motivo: "Volver a la cohorte anterior",
    });
    expect((await db.select({ cohortId: deals.cohortId }).from(deals).where(eq(deals.id, dealId)))[0].cohortId).toBe(activa.id);
    const [reversion] = await db.select().from(reversiones);
    const rastros = await db.select().from(changeLog).where(eq(changeLog.reversionId, reversion.id));
    expect(rastros.some((fila) => fila.campo === "cohortId")).toBe(true);
    expect(rastros.some((fila) => fila.tabla === "deal_actividades")).toBe(true);
  });

  it("valida la fecha límite anterior antes de restaurarla", async () => {
    const [cohorte] = await db.insert(cohorts).values({
      programId, codigo: "LIM", metaCupos: 10, precioUsd: "1000", estado: "activo",
      fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-11-15", fechaInicioClases: "2026-11-20",
    }).returning();
    const dealId = await deal();
    await db.update(deals).set({ cohortId: cohorte.id, fechaLimitePago: "2026-12-01" }).where(eq(deals.id, dealId));
    await editarConRastro({ db, tabla: deals, nombreTabla: "deals", actorId: autor, etiqueta: "Lead" }, dealId, { fechaLimitePago: "2026-11-10" });
    const changeLogId = await eventoEditado("deals", dealId, "fechaLimitePago");
    const e = await error(deshacerEvento(db, actor(autor), { dealId, evento: { tipo: "cambio", changeLogId } }));
    expect(e.status).toBe(422);
    expect((await db.select({ fecha: deals.fechaLimitePago }).from(deals).where(eq(deals.id, dealId)))[0].fecha).toBe("2026-11-10");
    expect(await db.select().from(reversiones)).toHaveLength(0);
  });
});
