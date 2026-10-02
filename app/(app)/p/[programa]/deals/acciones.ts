"use server";

import { z } from "zod";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { deals, etapaDealEnum } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { moverEtapa, MovimientoRechazado } from "@/lib/deals/mover-etapa";
import type { RequisitoFaltante } from "@/lib/deals/requisitos";
import { esquemaDescuentoUsdOpcional } from "@/lib/deals/valor-vendido";

/**
 * Server action del Kanban (ticket 069): mover un deal de etapa.
 *
 * Todo movimiento pasa por `moverEtapa()` (ADR 0037), que valida la flecha, quien
 * puede tomarla y lo que le falta al deal, y escribe el historial en una transaccion.
 *
 * 🔒 **El actor SIEMPRE sale de la sesion, nunca del input.** El `dealId` y los `datos`
 * vienen del cliente; el `userId` y el `rol` los pone el servidor. Aunque el cliente
 * mande un `userId`, se ignora: `moverEtapa` recibe el actor que arma esta accion.
 *
 * En un rechazo (`MovimientoRechazado`) se devuelven los `faltantes` con su `.mensaje`
 * para que la UI diga QUE falta, no un generico "no se puede" (ticket 044). La base NO
 * se mueve en un rechazo: lo garantiza el motor (la transaccion se deshace).
 *
 * El resultado es serializable (una server action viaja por red y una excepcion no
 * lleva su tipo), mismo patron que `mi-dia/acciones.ts`.
 */

/** Los datos que una flecha puede pedir, validados en el borde (zod). */
const esquemaDatos = z
  .object({
    descuentoUsd: esquemaDescuentoUsdOpcional,
    areaDeclaradaId: z.string().uuid().nullable().optional(),
    fechaLimitePago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").nullable().optional(),
    acuerdoPago: z.string().trim().max(500).nullable().optional(),
    cohorteDestinoId: z.string().uuid().nullable().optional(),
    fechaSeguimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").nullable().optional(),
  })
  .optional();

const esquemaMover = z.object({
  dealId: z.string().uuid("Deal inválido."),
  a: z.enum(etapaDealEnum.enumValues),
  motivoId: z.string().uuid().nullable().optional(),
  datos: esquemaDatos,
});

export type EntradaMover = z.input<typeof esquemaMover>;

export type ResultadoMover =
  | { ok: true }
  | { ok: false; error: string; faltantes: { codigo: string; mensaje: string }[]; status: number };

/** El actor del movimiento, armado desde la sesion. El rol es el DE VISTA (ticket 028). */
async function actorDe(session: Session): Promise<{ tipo: "usuario"; userId: string; rol: import("@/lib/auth/roles").Rol }> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { tipo: "usuario", userId: session.user.id, rol };
}

export async function moverDeal(entrada: EntradaMover): Promise<ResultadoMover> {
  // La ruta la ven gerente y closer (developer por esAccesoTotal); quien puede mover
  // ESTE deal lo decide `moverEtapa` (dueno o administrador). La guarda de aca es el
  // acceso a la accion, no al deal.
  const session = await requireRole("gerente", "closer");
  try {
    const mov = esquemaMover.parse(entrada);
    const actor = await actorDe(session);
    const [deal] = await db
      .select({ programId: deals.programId })
      .from(deals)
      .where(and(eq(deals.id, mov.dealId), incluyendoAnulados(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (!(await programaEnAlcance(actor.userId, actor.rol, deal.programId, db))) {
      throw new ErrorDeApp("No puedes mover un deal de otro programa.", 403);
    }
    await normalizando(() =>
      moverEtapa(db, {
        dealId: mov.dealId,
        a: mov.a,
        actor,
        motivoId: mov.motivoId ?? null,
        datos: mov.datos,
      }),
    );
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

function aResultado(error: unknown): { ok: false; error: string; faltantes: RequisitoFaltante[]; status: number } {
  if (error instanceof MovimientoRechazado) {
    return { ok: false, error: error.message, faltantes: error.faltantes, status: error.status };
  }
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message, faltantes: [], status: error.status };
  console.error("[deals] error no controlado al mover", error);
  return { ok: false, error: "Error interno.", faltantes: [], status: 500 };
}
