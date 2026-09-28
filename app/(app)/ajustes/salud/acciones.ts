"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { reprocesarSobre } from "@/lib/ingesta/procesar-sobre";
import { registrarEntrega } from "@/lib/queries/entregas-webhook";

/**
 * Server actions de la pantalla de salud del CRM (ticket 110).
 *
 * `requireRole("gerente")` es el enforce de `esAdministrador` en el SERVIDOR: el
 * developer pasa porque `puedeAcceder` lo deja (ADR 0025), y un closer recibe 403 —nunca
 * se escribe `"developer"` a mano ni se compara `rol === "..."`—. La regla vale aunque el
 * boton no aparezca: esconder un boton no es seguridad, y esta accion se puede forjar.
 *
 * El resultado es serializable: una server action viaja por red y una excepcion no lleva
 * su tipo. Un error interno sale como `{ ok: false }` con un mensaje seguro.
 */

export type ResultadoReproceso =
  | { ok: true; motivo: string }
  | { ok: false; error: string };

const idSchema = z.string().uuid("Id de sobre inválido.");

/**
 * Reprocesa un sobre crudo con error: vuelve a correr el adaptador y la ingesta sobre el
 * cuerpo ya guardado, marca `reprocesado_en` y registra el resultado como una entrega
 * NUEVA. El id del sobre entra por el cuerpo, pero se valida su forma (UUID) y el actor se
 * autentica antes: no hay dato personal en la ruta.
 */
export async function reprocesarSobreAccion(sobreId: string): Promise<ResultadoReproceso> {
  try {
    await requireRole("gerente");
    const id = idSchema.parse(sobreId);

    const reproceso = await reprocesarSobre(db, id);
    if (!reproceso) {
      return { ok: false, error: "El sobre no existe o ya no tiene error que reprocesar." };
    }

    // El reproceso es una entrega mas: se registra con su motivo, su lead y su sobre. Es
    // un 200 (no viene de la red del proveedor, pero es el codigo con el que se acepta un
    // sobre con firma buena). Registrar la entrega nunca tumba el reproceso (ADR 0058).
    await registrarEntrega(db, {
      programId: reproceso.programId,
      sourceId: reproceso.sourceId,
      sobreId: reproceso.sobreId,
      leadId: reproceso.resultado.leadId,
      codigoHttp: 200,
      motivo: reproceso.resultado.motivo,
    });

    revalidatePath("/ajustes/salud");
    return { ok: true, motivo: reproceso.resultado.motivo };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Petición inválida." };
    }
    console.error("[salud] error no controlado al reprocesar", error);
    return { ok: false, error: "Error interno." };
  }
}
