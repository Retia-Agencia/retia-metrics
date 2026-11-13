import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { programaEnAlcance } from "@/lib/auth/alcance";
import type { OrigenOperativo } from "@/lib/crm/rastro";
import { deals, etapaDealEnum, pendienteDealEnum } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { deshacerEvento, type EntradaDeshacerEvento } from "@/lib/deshacer/deshacer";
import { esquemaProximoContacto } from "./proximo-contacto";
import { esquemaDescuentoUsdOpcional } from "./valor-vendido";
import { moverEtapa, revisarMovimiento, type Actor, type RevisionDeMovimiento } from "./mover-etapa";

/** Los datos que una flecha puede pedir, compartidos por la pantalla y el MCP. */
export const esquemaDatos = z.object({
  descuentoUsd: esquemaDescuentoUsdOpcional,
  fechaLimitePago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").nullable().optional(),
  acuerdoPago: z.string().trim().max(500).nullable().optional(),
  cohorteDestinoId: z.string().uuid().nullable().optional(),
  fechaSeguimiento: esquemaProximoContacto,
}).optional();

export const esquemaMover = z.object({
  dealId: z.string().uuid("Deal inválido."),
  a: z.enum(etapaDealEnum.enumValues),
  pendiente: z.enum(pendienteDealEnum.enumValues).nullable().optional(),
  motivoId: z.string().uuid().nullable().optional(),
  comentarioMotivo: z.string().trim().max(4000, "El comentario es muy largo.").optional(),
  correccion: z.boolean().optional(),
  datos: esquemaDatos,
});

export const esquemaRevisar = esquemaMover.omit({ a: true }).extend({
  a: z.union([z.enum(etapaDealEnum.enumValues), z.literal("retroceso")]),
});

export type EntradaMover = z.input<typeof esquemaMover>;
export type EntradaRevisar = z.input<typeof esquemaRevisar>;
export type ActorDeMovimiento = Extract<Actor, { tipo: "usuario" }>;

async function exigirDealEnAlcance(db: Db, actor: ActorDeMovimiento, dealId: string) {
  const [deal] = await db.select({ programId: deals.programId }).from(deals)
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
  if (!(await programaEnAlcance(actor.userId, actor.rol, deal.programId, db))) {
    throw new ErrorDeApp("No puedes mover un deal de otro programa.", 403);
  }
  return deal;
}

export async function deshacerEventoComo(
  db: Db,
  actor: ActorDeMovimiento,
  entrada: EntradaDeshacerEvento,
  opciones: { origen: OrigenOperativo },
): Promise<void> {
  await exigirDealEnAlcance(db, actor, entrada.dealId);
  await deshacerEvento(db, actor, entrada, opciones);
}

export async function moverDealComo(
  db: Db,
  actor: ActorDeMovimiento,
  mov: z.output<typeof esquemaMover>,
  opciones: { origen: OrigenOperativo },
): Promise<void> {
  await exigirDealEnAlcance(db, actor, mov.dealId);
  if (mov.correccion) {
    await deshacerEventoComo(db, actor, {
      dealId: mov.dealId,
      evento: { tipo: "etapa", id: null, a: mov.a },
      motivo: mov.comentarioMotivo,
    }, opciones);
    return;
  }
  await moverEtapa(db, {
    dealId: mov.dealId,
    a: mov.a,
    pendiente: mov.pendiente,
    actor,
    motivoId: mov.motivoId ?? null,
    correccion: mov.correccion,
    datos: mov.datos,
    origen: opciones.origen,
  });
}

export async function revisarMovimientoComo(
  db: Db,
  actor: ActorDeMovimiento,
  mov: z.output<typeof esquemaRevisar>,
): Promise<RevisionDeMovimiento> {
  await exigirDealEnAlcance(db, actor, mov.dealId);
  return revisarMovimiento(db, {
    dealId: mov.dealId,
    a: mov.a,
    pendiente: mov.pendiente,
    actor,
    motivoId: mov.motivoId ?? null,
    correccion: mov.correccion,
    datos: mov.datos,
  });
}
