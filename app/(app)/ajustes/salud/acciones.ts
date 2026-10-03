"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { reprocesarSobre } from "@/lib/ingesta/procesar-sobre";
import {
  descifrarCursor,
  entregasDePrograma,
  entregasHuerfanas,
  registrarEntrega,
  type EntregaListada,
} from "@/lib/queries/entregas-webhook";
import { programasActivos } from "@/lib/queries/programas";

/**
 * Server actions de Webhook Health (ticket 110, renombrado por el 173).
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
    const id = await normalizando(async () => idSchema.parse(sobreId));

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
    console.error("[salud] error no controlado al reprocesar", error);
    return { ok: false, error: "Error interno." };
  }
}

/**
 * Una entrega serializable para el cliente: la fecha viaja como ISO (una server action
 * cruza la red y un `Date` no sobrevive el salto). Es la misma forma que `EntregaVista`
 * de la pantalla.
 */
export interface EntregaSerializada extends Omit<EntregaListada, "recibidoEn"> {
  recibidoEn: string;
}

/** El resultado de "Ver anteriores": las siguientes entregas y el cursor de la que sigue. */
export type ResultadoMasEntregas =
  | { ok: true; entregas: EntregaSerializada[]; cursor: string | null }
  | { ok: false; error: string };

const esquemaMas = z.object({
  // El slug del programa, o `null` para las huerfanas. El programa es frontera: se
  // resuelve contra los programas activos, nunca se confia el id crudo del cliente.
  programaSlug: z.string().min(1).nullable(),
  cursor: z.string().min(1),
});

function serializar(entregas: EntregaListada[]): EntregaSerializada[] {
  return entregas.map((e) => ({ ...e, recibidoEn: e.recibidoEn.toISOString() }));
}

/**
 * Carga la siguiente pagina de entregas bajo demanda ("Ver anteriores"), por el cursor
 * keyset de la ultima mostrada. Re-verifica el rol en el SERVIDOR (`requireRole`): la
 * paginacion no es una excepcion a "esconder un boton no es seguridad". El cursor se
 * valida en el borde; uno malformado se trata como primera pagina (no revienta).
 */
export async function cargarMasEntregasAccion(
  programaSlug: string | null,
  cursor: string,
): Promise<ResultadoMasEntregas> {
  try {
    await requireRole("gerente");
    const datos = await normalizando(async () => esquemaMas.parse({ programaSlug, cursor }));
    const cur = descifrarCursor(datos.cursor);

    if (datos.programaSlug === null) {
      const pagina = await entregasHuerfanas(cur, db);
      return { ok: true, entregas: serializar(pagina.entregas), cursor: pagina.cursor };
    }

    const programa = (await programasActivos()).find((p) => p.slug === datos.programaSlug);
    if (!programa) return { ok: false, error: "Programa no encontrado." };
    const pagina = await entregasDePrograma(programa.id, cur, db);
    return { ok: true, entregas: serializar(pagina.entregas), cursor: pagina.cursor };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[salud] error no controlado al cargar más entregas", error);
    return { ok: false, error: "Error interno." };
  }
}
