import { estadosLlegada } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ESTADOS_LLEGADA_BASE, PLANTILLA_LEAD_BASE } from "../../scripts/estados-llegada-base";

/**
 * Lo minimo para que un programa de prueba este ACTIVO: desde la migracion 0031 un
 * programa nace inactivo y el CHECK `programs_activo_con_formulario_y_token` exige
 * Forms Link y token de Calendly para activarlo (ADR 0057).
 *
 * Trae tambien la plantilla de lead (ticket 117): el webhook ya no tiene defecto en el
 * codigo, y sin saber que pregunta trae el correo cada envio fallaria. Es la misma que
 * se carga en produccion (`scripts/estados-llegada-base.ts`), para que los tests prueben
 * lo que corre.
 *
 * Va PRIMERO en el `values`, para que un test que pida `activo: false` siga ganando.
 */
export const PROGRAMA_DE_PRUEBA = {
  activo: true,
  formUrl: "https://form.typeform.com/to/prueba",
  calendlyToken: "token-de-prueba",
  plantillaLead: PLANTILLA_LEAD_BASE,
} as const;

/**
 * Los Estados de llegada que se siembran en produccion (ticket 117). Sin filas en
 * `estados_llegada` ningun envio abre deal: un test que espera un deal las siembra con
 * `sembrarEstadosDeLlegada`.
 */
export const ESTADOS_DE_PRUEBA = ESTADOS_LLEGADA_BASE;

export async function sembrarEstadosDeLlegada(
  db: Db,
  programId: string,
  filas: readonly {
    valor: string;
    etapaEntrada: "pendiente_setteo" | "agendado" | null;
    prioridad: "normal" | "alta";
    alertaMinutos: number | null;
  }[] = ESTADOS_DE_PRUEBA,
): Promise<void> {
  await db.insert(estadosLlegada).values(filas.map((f) => ({ programId, ...f })));
}
