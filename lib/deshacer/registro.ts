import type { PgTable } from "drizzle-orm/pg-core";
import { deals, calls, abonos, dealActividades } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ActorDeDeal } from "@/lib/deals/permiso";
import { editarConRastro, type Contexto } from "@/lib/crm/rastro";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { and, eq } from "drizzle-orm";
import { cambiarDuenoDeal } from "@/lib/deals/cambiar-dueno";
import { cambiarCohorte } from "@/lib/deals/estudiante";
import { exigirFechaLimiteValida } from "@/lib/deals/pago";
import { corregirResultado, RESULTADOS_CORREGIBLES } from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import type { OrigenOperativo } from "@/lib/crm/rastro";

export interface FilaDeGrupo {
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
}

export interface ContextoDeRestauracion {
  motivo: string | null;
  filas: readonly FilaDeGrupo[];
  esCortesia: boolean;
  origen: OrigenOperativo;
}

export type RestaurarCampo = (
  tx: Db,
  actor: ActorDeDeal,
  registroId: string,
  valorAnterior: string | null,
  reversionId: string,
  contexto: ContextoDeRestauracion,
) => Promise<void>;

export type ReglaDeCampo = { restaurar: RestaurarCampo } | { no: string; omitirEnGrupo?: true };

function convertir(valor: string | null, actual: unknown): unknown {
  if (valor === null) return null;
  if (actual instanceof Date) return new Date(valor);
  if (typeof actual === "boolean") return valor === "true";
  if (typeof actual === "number") return Number(valor);
  if (actual != null && typeof actual === "object") return JSON.parse(valor);
  return valor;
}

function restaurar(tabla: PgTable, nombreTabla: Contexto["nombreTabla"], campo: string): ReglaDeCampo {
  return {
    restaurar: async (tx, actor, registroId, valorAnterior, reversionId, contexto) => {
      const columnas = tabla as unknown as Record<string, unknown>;
      const filas = await tx.select().from(tabla).where(and(
        // La PK de las cuatro tablas es `id`; drizzle conserva el tipo en runtime.
        eq(columnas.id as never, registroId),
        incluyendoAnulados(tabla),
      )) as unknown as Record<string, unknown>[];
      const actual = filas[0];
      if (!actual) return;
      await editarConRastro(
        { db: tx, tabla, nombreTabla, actorId: actor.userId, etiqueta: registroId, reversionId, origen: contexto.origen },
        registroId,
        { [campo]: convertir(valorAnterior, actual[campo]) },
      );
    },
  };
}

const no = (razon: string): ReglaDeCampo => ({ no: razon });
const sistema: ReglaDeCampo = { no: "Este campo lo escribe el sistema.", omitirEnGrupo: true };
const identidad = no("La identidad del registro no cambia.");
const anulacion = no("Una anulación no se deshace.");

const restaurarDueno: ReglaDeCampo = {
  restaurar: async (tx, actor, registroId, valorAnterior, reversionId, contexto) => {
    const [deal] = await tx.select({ ownerUserId: deals.ownerUserId }).from(deals)
      .where(and(eq(deals.id, registroId), incluyendoAnulados(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    await cambiarDuenoDeal(tx, {
      dealId: registroId,
      ownerActual: deal.ownerUserId,
      ownerNuevo: valorAnterior,
      actorId: actor.userId,
      etiqueta: registroId,
      esNovedad: false,
      reversionId,
      origen: contexto.origen,
    });
  },
};

const restaurarCohorte: ReglaDeCampo = {
  restaurar: async (tx, actor, registroId, valorAnterior, reversionId, contexto) => {
    if (valorAnterior == null) {
      throw new ErrorDeApp("No se puede deshacer un cambio que dejaría el deal sin cohorte.", 409);
    }
    await cambiarCohorte(tx, actor, {
      dealId: registroId,
      cohortId: valorAnterior,
      motivo: contexto.motivo ?? "Se deshizo el cambio de cohorte.",
    }, { reversionId, origen: contexto.origen });
  },
};

const restaurarFechaLimite: ReglaDeCampo = {
  restaurar: async (tx, actor, registroId, valorAnterior, reversionId, contexto) => {
    const [deal] = await tx.select().from(deals)
      .where(and(eq(deals.id, registroId), incluyendoAnulados(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (valorAnterior !== null) await exigirFechaLimiteValida(tx, deal, valorAnterior);
    await editarConRastro(
      { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: registroId, reversionId, origen: contexto.origen },
      registroId,
      { fechaLimitePago: valorAnterior },
    );
  },
};

const restaurarResultado: ReglaDeCampo = {
  restaurar: async (tx, actor, registroId, valorAnterior, reversionId, contexto) => {
    const [llamada] = await tx.select().from(calls)
      .where(and(eq(calls.id, registroId), incluyendoAnulados(calls)));
    if (!llamada || valorAnterior == null) throw new ErrorDeApp("Ese resultado no se puede restaurar.", 409);
    if (valorAnterior === "agendada") {
      await editarConRastro(
        { db: tx, tabla: calls, nombreTabla: "calls", actorId: actor.userId, etiqueta: llamada.emailLead ?? llamada.id, reversionId, origen: contexto.origen },
        registroId,
        { resultado: valorAnterior },
      );
      return;
    }
    if (!(RESULTADOS_CORREGIBLES as readonly string[]).includes(valorAnterior)
      || !(RESULTADOS_CORREGIBLES as readonly string[]).includes(llamada.resultado)) {
      throw new ErrorDeApp("Ese resultado no se puede restaurar.", 409);
    }
    await corregirResultado(tx, actor, {
      callId: registroId,
      resultado: valorAnterior as (typeof RESULTADOS_CORREGIBLES)[number],
      motivo: contexto.motivo ?? "Se deshizo el cambio de resultado.",
    }, { reversionId, origen: contexto.origen });
  },
};

const restaurarDatoDeCita = (campo: "fechaAgenda" | "linkCalendly"): ReglaDeCampo => ({
  restaurar: async (tx, actor, registroId, valorAnterior, reversionId, contexto) => {
    const [llamada] = await tx.select().from(calls)
      .where(and(eq(calls.id, registroId), incluyendoAnulados(calls)));
    if (!llamada) throw new ErrorDeApp("No existe la llamada.", 404);
    if (llamada.origen === "calendly") throw new ErrorDeApp("La hora de la cita la manda Calendly; se reagenda.", 409);
    await editarConRastro(
      { db: tx, tabla: calls, nombreTabla: "calls", actorId: actor.userId, etiqueta: llamada.emailLead ?? llamada.id, reversionId, origen: contexto.origen },
      registroId,
      { [campo]: convertir(valorAnterior, llamada[campo]) },
    );
  },
});

export const registroDeals = {
  id: identidad, leadId: identidad, programId: identidad,
  cohortId: restaurarCohorte,
  ownerUserId: restaurarDueno,
  ownerNovedadEn: sistema,
  setterUserId: restaurar(deals, "deals", "setterUserId"),
  handoffEn: restaurar(deals, "deals", "handoffEn"),
  etapa: no("La etapa se corrige con el motor."),
  pendiente: no("El pendiente se corrige con el motor."),
  acuerdoPago: restaurar(deals, "deals", "acuerdoPago"),
  fechaLimitePago: restaurarFechaLimite,
  fechaSeguimiento: restaurar(deals, "deals", "fechaSeguimiento"),
  motivoId: restaurar(deals, "deals", "motivoId"),
  submissionOrigenId: sistema,
  onboardedAt: restaurar(deals, "deals", "onboardedAt"),
  cohorteDestinoId: restaurar(deals, "deals", "cohorteDestinoId"),
  cohorteDestinoTexto: restaurar(deals, "deals", "cohorteDestinoTexto"),
  valorVendidoUsd: restaurar(deals, "deals", "valorVendidoUsd"),
  comisionPorcentaje: sistema,
  cortesia: restaurar(deals, "deals", "cortesia"),
  creadoPor: identidad,
  anuladoEn: anulacion, anuladoPor: anulacion, motivoAnulacion: anulacion,
  huellaMigracion: sistema, createdAt: identidad, updatedAt: sistema,
} satisfies Record<keyof typeof deals.$inferSelect, ReglaDeCampo>;

export const registroCalls = {
  id: identidad,
  dealId: restaurar(calls, "calls", "dealId"),
  programId: identidad,
  closerUserId: restaurar(calls, "calls", "closerUserId"),
  linkCalendly: restaurarDatoDeCita("linkCalendly"),
  linkGrain: restaurar(calls, "calls", "linkGrain"),
  calendlyHostEmail: sistema, emailLead: sistema,
  fechaAgenda: restaurarDatoDeCita("fechaAgenda"),
  fechaLlamada: restaurar(calls, "calls", "fechaLlamada"),
  resultado: restaurarResultado,
  fechaSeguimiento: restaurar(calls, "calls", "fechaSeguimiento"),
  motivoId: restaurar(calls, "calls", "motivoId"),
  notas: restaurar(calls, "calls", "notas"),
  origen: identidad, huellaFila: sistema, raw: sistema,
  anuladoEn: anulacion, anuladoPor: anulacion, motivoAnulacion: anulacion, createdAt: identidad,
} satisfies Record<keyof typeof calls.$inferSelect, ReglaDeCampo>;

export const registroAbonos = {
  id: identidad, dealId: identidad, programId: identidad,
  fecha: no("Un pago mal registrado se deshace anulando el abono."),
  monto: no("Un pago mal registrado se deshace anulando el abono."),
  moneda: no("Un pago mal registrado se deshace anulando el abono."),
  plataformaId: no("Un pago mal registrado se deshace anulando el abono."),
  enlacePagoId: restaurar(abonos, "abonos", "enlacePagoId"),
  comprobanteUrl: restaurar(abonos, "abonos", "comprobanteUrl"),
  comprobanteArchivoId: restaurar(abonos, "abonos", "comprobanteArchivoId"),
  registradoPorUserId: identidad, closerId: sistema, origen: identidad,
  concepto: no("Un pago mal registrado se deshace anulando el abono."), nota: restaurar(abonos, "abonos", "nota"),
  anuladoEn: anulacion, anuladoPor: anulacion, motivoAnulacion: anulacion,
  huellaMigracion: sistema, createdAt: identidad,
} satisfies Record<keyof typeof abonos.$inferSelect, ReglaDeCampo>;

export const registroActividades = {
  id: identidad, dealId: identidad,
  tipo: restaurar(dealActividades, "deal_actividades", "tipo"),
  canal: restaurar(dealActividades, "deal_actividades", "canal"), userId: identidad,
  fecha: restaurar(dealActividades, "deal_actividades", "fecha"),
  nota: restaurar(dealActividades, "deal_actividades", "nota"),
  proximoContacto: restaurar(dealActividades, "deal_actividades", "proximoContacto"),
  pendientePuesto: sistema,
  anuladoEn: anulacion, anuladoPor: anulacion, motivoAnulacion: anulacion,
} satisfies Record<keyof typeof dealActividades.$inferSelect, ReglaDeCampo>;

export const REGISTRO = {
  deals: registroDeals,
  calls: registroCalls,
  abonos: registroAbonos,
  deal_actividades: registroActividades,
} as const;

export type TablaDeshacible = keyof typeof REGISTRO;
