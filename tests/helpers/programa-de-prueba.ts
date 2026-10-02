import { PLANTILLA_LEAD_BASE } from "../../scripts/plantilla-lead-base";

/**
 * Lo minimo para que un programa de prueba este ACTIVO: desde la migracion 0031 un
 * programa nace inactivo y el CHECK `programs_activo_con_formulario_y_token` exige
 * Forms Link y token de Calendly para activarlo (ADR 0057).
 *
 * Trae tambien la plantilla de lead (ticket 117): el webhook ya no tiene defecto en el
 * codigo, y sin saber que pregunta trae el correo cada envio fallaria. Es la misma que
 * se carga en produccion (`scripts/plantilla-lead-base.ts`), para que los tests prueben
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
