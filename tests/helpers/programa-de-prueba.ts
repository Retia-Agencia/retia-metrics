/**
 * Lo minimo para que un programa de prueba este ACTIVO: desde la migracion 0031 un
 * programa nace inactivo y el CHECK `programs_activo_con_formulario_y_token` exige
 * Forms Link y token de Calendly para activarlo (ADR 0057).
 *
 * Va PRIMERO en el `values`, para que un test que pida `activo: false` siga ganando.
 */
export const PROGRAMA_DE_PRUEBA = {
  activo: true,
  formUrl: "https://form.typeform.com/to/prueba",
  calendlyToken: "token-de-prueba",
} as const;
