import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { abonos, calls, changeLog, dealActividades, dealEtapaHistorial, deals, motivos, reversiones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { puedeDeshacer, puedeTrabajarDeal, type ActorDeDeal } from "@/lib/deals/permiso";
import { esAdministrador } from "@/lib/auth/roles";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { anularAbono } from "@/lib/deals/abonos";
import { anularDeal } from "@/lib/deals/anular-deal";
import { anularActividad } from "@/lib/deals/actividades";
import { anularLlamada, RESULTADOS_CORREGIBLES } from "@/lib/deals/llamadas";
import { REGISTRO, type ContextoDeRestauracion, type FilaDeGrupo, type ReglaDeCampo, type TablaDeshacible } from "./registro";

export const esquemaDeshacerEvento = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  evento: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("etapa"), id: z.string().uuid().nullable(), a: z.enum(deals.etapa.enumValues) }),
    z.object({ tipo: z.literal("cambio"), changeLogId: z.string().uuid() }),
  ]),
  motivo: z.string().trim().optional(),
});
export type EntradaDeshacerEvento = z.input<typeof esquemaDeshacerEvento>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
type FilaCambio = typeof changeLog.$inferSelect;

export type ClasificacionDeGrupo = { tipo: "creacion" } | { tipo: "restaurar" } | { tipo: "no"; razon: string };

const compararTexto = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function idDelGrupo(filas: readonly Pick<FilaCambio, "id">[]): string {
  const id = filas.map((fila) => fila.id).sort(compararTexto)[0];
  if (!id) throw new Error("Un grupo de cambios no puede estar vacío.");
  return id;
}

function claveDeGrupo(fila: Pick<FilaCambio, "tabla" | "registroId" | "detectadoEn" | "userId">): string {
  return [fila.tabla, fila.registroId ?? "", fila.detectadoEn.toISOString(), fila.userId ?? ""].join("\u0000");
}

function agrupar(filas: readonly FilaCambio[]): FilaCambio[][] {
  const grupos = new Map<string, FilaCambio[]>();
  for (const fila of filas) {
    const clave = claveDeGrupo(fila);
    const grupo = grupos.get(clave) ?? [];
    grupo.push(fila);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].map((grupo) => grupo.sort((a, b) => compararTexto(a.id, b.id)));
}

export function clasificarGrupo(
  filas: readonly FilaCambio[],
  contexto: { esPrimerGrupo: boolean; razonDinamica?: string | null },
): ClasificacionDeGrupo {
  if (contexto.esPrimerGrupo && filas.every((fila) => fila.valorAnterior === null)) return { tipo: "creacion" };
  if (contexto.razonDinamica) return { tipo: "no", razon: contexto.razonDinamica };
  const tabla = filas[0]?.tabla;
  if (!tabla || !(tabla in REGISTRO)) return { tipo: "no", razon: "Este cambio no se puede deshacer." };
  const reglas = REGISTRO[tabla as TablaDeshacible] as Record<string, ReglaDeCampo>;
  const bloqueante = filas.map((fila) => reglas[fila.campo]).find((regla) => regla && "no" in regla && !regla.omitirEnGrupo);
  if (bloqueante && "no" in bloqueante) return { tipo: "no", razon: bloqueante.no };
  if (filas.some((fila) => reglas[fila.campo] && "restaurar" in reglas[fila.campo])) return { tipo: "restaurar" };
  const razon = filas.map((fila) => reglas[fila.campo]).find((regla) => regla && "no" in regla);
  return { tipo: "no", razon: razon && "no" in razon ? razon.no : "Este cambio no se puede deshacer." };
}

function esPrimerGrupo(grupo: readonly FilaCambio[], gruposDelRegistro: readonly FilaCambio[][]): boolean {
  const ordenados = [...gruposDelRegistro].sort((a, b) => a[0].detectadoEn.getTime() - b[0].detectadoEn.getTime());
  return idDelGrupo(ordenados[0] ?? []) === idDelGrupo(grupo);
}

async function razonDinamica(tx: Db, filas: readonly FilaCambio[]): Promise<string | null> {
  const primera = filas[0];
  if (!primera?.registroId) return "Este cambio no se puede deshacer.";
  if (primera.tabla === "calls") {
    const [llamada] = await tx.select().from(calls)
      .where(and(eq(calls.id, primera.registroId), incluyendoAnulados(calls)));
    if (!llamada) return "No existe la llamada.";
    if (llamada.origen === "calendly" && filas.some((fila) => fila.campo === "fechaAgenda" || fila.campo === "linkCalendly")) {
      return "La hora de la cita la manda Calendly; se reagenda.";
    }
    const resultado = filas.find((fila) => fila.campo === "resultado");
    if (resultado) {
      const anteriorValido = resultado.valorAnterior === "agendada"
        || (resultado.valorAnterior != null && (RESULTADOS_CORREGIBLES as readonly string[]).includes(resultado.valorAnterior));
      const actualValido = resultado.valorAnterior === "agendada"
        || (RESULTADOS_CORREGIBLES as readonly string[]).includes(llamada.resultado);
      if (!anteriorValido || !actualValido) return "Ese resultado no se puede restaurar.";
    }
    const cambioDeal = filas.find((fila) => fila.campo === "dealId");
    if (cambioDeal && (llamada.origen !== "calendly" || cambioDeal.valorAnterior !== null)) {
      return "Esta asignación de llamada no se puede deshacer.";
    }
  }
  if (primera.tabla === "deals") {
    const [deal] = await tx.select({ etapa: deals.etapa }).from(deals)
      .where(and(eq(deals.id, primera.registroId), incluyendoAnulados(deals)));
    const esCortesia = filas.some((fila) => fila.campo === "cortesia" && fila.valorAnterior === "false");
    if (!esCortesia && filas.some((fila) => fila.campo === "valorVendidoUsd")
      && (deal?.etapa === "ganado_parcial" || deal?.etapa === "ganado_completo")) {
      return "El valor vendido de una venta no se restaura en crudo.";
    }
    if (filas.some((fila) => fila.campo === "cohortId" && fila.valorAnterior === null)) {
      return "No se puede deshacer un cambio que dejaría el deal sin cohorte.";
    }
  }
  return null;
}

async function gruposDelRegistro(tx: Db, evento: FilaCambio): Promise<FilaCambio[][]> {
  if (evento.registroId == null) return [];
  const filas = await tx.select().from(changeLog).where(and(
    eq(changeLog.tabla, evento.tabla), eq(changeLog.registroId, evento.registroId),
  )).orderBy(changeLog.detectadoEn);
  return agrupar(filas);
}

/** El grupo humano que creó un registro, para que los botones viejos también dejen reversión. */
export async function eventoDeCreacion(
  db: Db,
  tabla: TablaDeshacible,
  registroId: string,
): Promise<string | null> {
  const filas = await db.select().from(changeLog).where(and(
    eq(changeLog.tabla, tabla),
    eq(changeLog.registroId, registroId),
  )).orderBy(changeLog.detectadoEn);
  const grupo = agrupar(filas).find((candidato) =>
    candidato[0]?.userId != null
    && candidato.every((fila) => fila.valorAnterior === null && fila.reversionId == null),
  );
  return grupo ? idDelGrupo(grupo) : null;
}

async function insertarReversion(
  tx: Db,
  valores: typeof reversiones.$inferInsert,
): Promise<void> {
  const insertadas = await tx.insert(reversiones).values(valores).onConflictDoNothing().returning();
  if (insertadas.length === 0) throw new ErrorDeApp("Esto ya se deshizo.", 409);
}

async function dealIdDeRegistro(tx: Db, tabla: TablaDeshacible, registroId: string): Promise<string | null> {
  if (tabla === "deals") return registroId;
  const tablaDrizzle = tabla === "calls" ? calls : tabla === "abonos" ? abonos : dealActividades;
  const [fila] = await tx.select({ dealId: tablaDrizzle.dealId }).from(tablaDrizzle)
    .where(and(eq(tablaDrizzle.id, registroId), incluyendoAnulados(tablaDrizzle)));
  return fila?.dealId ?? null;
}

async function deshacerCambio(
  tx: Db,
  actor: ActorDeDeal,
  entrada: z.output<typeof esquemaDeshacerEvento> & { evento: { tipo: "cambio"; changeLogId: string } },
  deal: typeof deals.$inferSelect,
): Promise<void> {
  const [evento] = await tx.select().from(changeLog).where(eq(changeLog.id, entrada.evento.changeLogId));
  if (!evento || evento.userId == null || evento.reversionId != null || !(evento.tabla in REGISTRO) || evento.registroId == null) {
    throw new ErrorDeApp("Este cambio no se puede deshacer.", 409);
  }
  const tabla = evento.tabla as TablaDeshacible;
  if (await dealIdDeRegistro(tx, tabla, evento.registroId) !== entrada.dealId) throw new ErrorDeApp("No existe ese evento en el deal.", 404);
  const grupos = await gruposDelRegistro(tx, evento);
  const filas = grupos.find((grupo) => grupo.some((fila) => fila.id === evento.id));
  if (!filas) throw new ErrorDeApp("Este cambio no se puede deshacer.", 409);
  const clasificacion = clasificarGrupo(filas, {
    esPrimerGrupo: esPrimerGrupo(filas, grupos),
    razonDinamica: await razonDinamica(tx, filas),
  });
  if (clasificacion.tipo === "no") throw new ErrorDeApp(clasificacion.razon, 409);
  if (filas.some((fila) => fila.campo === "cortesia") && !esAdministrador(actor.rol)) {
    throw new ErrorDeApp("Solo quien administra puede deshacer una cortesía.", 403);
  }
  if (!puedeDeshacer(actor, { autorId: evento.userId, ownerUserId: deal.ownerUserId, campo: evento.campo })) {
    throw new ErrorDeApp("No puedes deshacer este evento.", 403);
  }

  const reversionId = crypto.randomUUID();
  await insertarReversion(tx, {
    id: reversionId, dealId: entrada.dealId, eventoTipo: "cambio", eventoId: idDelGrupo(filas),
    motivo: entrada.motivo?.trim() || null, userId: actor.userId,
  });

  if (clasificacion.tipo === "creacion") {
    if (tabla === "abonos") await anularAbono(tx, actor, { abonoId: evento.registroId, motivo: entrada.motivo }, { reversionId });
    else if (tabla === "deals") await anularDeal(tx, actor, { dealId: evento.registroId, motivo: entrada.motivo }, { reversionId, permisoValidado: true });
    else if (tabla === "calls") await anularLlamada(tx, actor, { callId: evento.registroId, motivo: entrada.motivo }, { reversionId, permisoValidado: true });
    else await anularActividad(tx, actor, { actividadId: evento.registroId, motivo: entrada.motivo }, { reversionId, permisoValidado: true });
    return;
  }

  const contexto: ContextoDeRestauracion = {
    motivo: entrada.motivo?.trim() || null,
    filas: filas as FilaDeGrupo[],
    esCortesia: tabla === "deals" && filas.some((fila) => fila.campo === "cortesia" && fila.valorAnterior === "false"),
  };
  for (const fila of filas) {
    const r = (REGISTRO[tabla] as Record<string, ReglaDeCampo>)[fila.campo];
    if (r && "no" in r && r.omitirEnGrupo) continue;
    if (!r || !("restaurar" in r)) throw new ErrorDeApp(r?.no ?? "El cambio incluye un campo que no se puede deshacer.", 409);
    await r.restaurar(tx, actor, evento.registroId, fila.valorAnterior, reversionId, contexto);
  }

  if (tabla === "deals" && filas.some((fila) => fila.campo === "cortesia" && fila.valorAnterior === "false")) {
    const [origen] = await tx.select({ de: dealEtapaHistorial.de }).from(dealEtapaHistorial)
      .where(and(eq(dealEtapaHistorial.dealId, deal.id), eq(dealEtapaHistorial.a, "ganado_completo")))
      .orderBy(desc(dealEtapaHistorial.fecha), desc(dealEtapaHistorial.id)).limit(1);
    if (!origen?.de) throw new ErrorDeApp("No se encontró la etapa anterior de la cortesía.", 409);
    await moverEtapa(tx, { dealId: deal.id, a: origen.de, actor: { tipo: "usuario", ...actor }, correccion: true, reversionId, permitirSalirDeGanado: true });
  }
}

async function deshacerEtapa(
  tx: Db,
  actor: ActorDeDeal,
  entrada: z.output<typeof esquemaDeshacerEvento> & { evento: { tipo: "etapa"; id: string | null; a: typeof deals.$inferSelect.etapa } },
  deal: typeof deals.$inferSelect,
): Promise<void> {
  let historia: typeof dealEtapaHistorial.$inferSelect | undefined;
  if (entrada.evento.id) {
    const [fila] = await tx.select({ historia: dealEtapaHistorial, tipoMotivo: motivos.tipo })
      .from(dealEtapaHistorial).leftJoin(motivos, eq(motivos.id, dealEtapaHistorial.motivoId))
      .where(eq(dealEtapaHistorial.id, entrada.evento.id));
    if (!fila || fila.historia.dealId !== deal.id) throw new ErrorDeApp("No existe ese evento en el deal.", 404);
    if (fila.historia.userId == null || fila.historia.reversionId != null || fila.tipoMotivo === "correccion") {
      throw new ErrorDeApp("Ese movimiento no se puede deshacer.", 409);
    }
    if (!puedeDeshacer(actor, { autorId: fila.historia.userId, ownerUserId: deal.ownerUserId })) throw new ErrorDeApp("No puedes deshacer este evento.", 403);
    historia = fila.historia;
  } else if (!esAdministrador(actor.rol) && !puedeTrabajarDeal(actor, deal)) {
    throw new ErrorDeApp("No puedes corregir este deal.", 403);
  }
  const reversionId = crypto.randomUUID();
  await insertarReversion(tx, { id: reversionId, dealId: deal.id, eventoTipo: "etapa", eventoId: entrada.evento.id, motivo: entrada.motivo?.trim() || null, userId: actor.userId });
  await moverEtapa(tx, {
    dealId: deal.id, a: entrada.evento.a, actor: { tipo: "usuario", ...actor }, correccion: true, reversionId,
    pendiente: historia?.de === entrada.evento.a ? historia.pendienteDe : null,
  });
}

export async function deshacerEvento(db: Db, actor: ActorDeDeal, datos: EntradaDeshacerEvento): Promise<void> {
  return normalizando(async () => {
    const entrada = esquemaDeshacerEvento.parse(datos);
    await (db as unknown as Transaccion).transaction(async (tx) => {
      const [deal] = await tx.select().from(deals)
        .where(and(eq(deals.id, entrada.dealId), incluyendoAnulados(deals))).for("update");
      if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
      if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado.", 409);
      if (entrada.evento.tipo === "cambio") await deshacerCambio(tx, actor, { ...entrada, evento: entrada.evento }, deal);
      else await deshacerEtapa(tx, actor, { ...entrada, evento: entrada.evento }, deal);
    });
  });
}

export interface EventoDeshacible {
  id: string;
  puedeDeshacer: boolean;
  resumen: { campo: string; ahora: string | null; quedaria: string | null }[];
  deshecho: { userId: string; fecha: Date; motivo: string | null } | null;
}

/** Proyección única para la ficha y para validar qué se ofrece. */
export async function eventosDeshacibles(db: Db, actor: ActorDeDeal, dealId: string): Promise<EventoDeshacible[]> {
  const [deal] = await db.select().from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
  const [llamadas, pagos, actividades] = await Promise.all([
    db.select({ id: calls.id }).from(calls).where(and(eq(calls.dealId, dealId), incluyendoAnulados(calls))),
    db.select({ id: abonos.id }).from(abonos).where(and(eq(abonos.dealId, dealId), incluyendoAnulados(abonos))),
    db.select({ id: dealActividades.id }).from(dealActividades).where(and(eq(dealActividades.dealId, dealId), incluyendoAnulados(dealActividades))),
  ]);
  const ids = [dealId, ...llamadas.map((fila) => fila.id), ...pagos.map((fila) => fila.id), ...actividades.map((fila) => fila.id)];
  const filas = await db.select().from(changeLog)
    .where(inArray(changeLog.registroId, ids)).orderBy(desc(changeLog.detectadoEn));
  const grupos = agrupar(filas);
  const gruposPorRegistro = new Map<string, FilaCambio[][]>();
  for (const grupo of grupos) {
    const clave = `${grupo[0].tabla}\u0000${grupo[0].registroId ?? ""}`;
    gruposPorRegistro.set(clave, [...(gruposPorRegistro.get(clave) ?? []), grupo]);
  }
  const idsDeGrupo = grupos.map(idDelGrupo);
  const reversionesDeCambios = idsDeGrupo.length > 0
    ? await db.select().from(reversiones).where(and(eq(reversiones.eventoTipo, "cambio"), inArray(reversiones.eventoId, idsDeGrupo)))
    : [];
  const reversionPorEvento = new Map(reversionesDeCambios.map((fila) => [fila.eventoId, fila]));
  const cambios: EventoDeshacible[] = [];
  for (const grupo of grupos) {
    const primera = grupo[0];
    const claveRegistro = `${primera.tabla}\u0000${primera.registroId ?? ""}`;
    const clasificacion = clasificarGrupo(grupo, {
      esPrimerGrupo: esPrimerGrupo(grupo, gruposPorRegistro.get(claveRegistro) ?? []),
      razonDinamica: await razonDinamica(db, grupo),
    });
    const id = idDelGrupo(grupo);
    const reversion = reversionPorEvento.get(id) ?? null;
    const cortesiaRestringida = grupo.some((fila) => fila.campo === "cortesia") && !esAdministrador(actor.rol);
    cambios.push({
      id,
      puedeDeshacer: clasificacion.tipo !== "no" && reversion == null && primera.userId != null
        && grupo.every((fila) => fila.reversionId == null) && !cortesiaRestringida
        && puedeDeshacer(actor, { autorId: primera.userId, ownerUserId: deal.ownerUserId, campo: primera.campo }),
      resumen: grupo.map((fila) => ({ campo: fila.campo, ahora: fila.valorNuevo, quedaria: fila.valorAnterior })),
      deshecho: reversion ? { userId: reversion.userId, fecha: reversion.fecha, motivo: reversion.motivo } : null,
    });
  }
  const etapas = await db.select({ historia: dealEtapaHistorial, reversion: reversiones, tipoMotivo: motivos.tipo })
    .from(dealEtapaHistorial)
    .leftJoin(motivos, eq(motivos.id, dealEtapaHistorial.motivoId))
    .leftJoin(reversiones, and(eq(reversiones.eventoTipo, "etapa"), eq(reversiones.eventoId, dealEtapaHistorial.id)))
    .where(eq(dealEtapaHistorial.dealId, dealId)).orderBy(desc(dealEtapaHistorial.fecha));
  return [
    ...cambios,
    ...etapas.map(({ historia, reversion, tipoMotivo }) => ({
      id: historia.id,
      puedeDeshacer: historia.userId != null && historia.reversionId == null && reversion == null && tipoMotivo !== "correccion"
        && puedeDeshacer(actor, { autorId: historia.userId, ownerUserId: deal.ownerUserId }),
      resumen: [{ campo: "etapa", ahora: historia.a, quedaria: historia.de }],
      deshecho: reversion ? { userId: reversion.userId, fecha: reversion.fecha, motivo: reversion.motivo } : null,
    })),
  ];
}
