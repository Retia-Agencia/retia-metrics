/**
 * El Estado de llegada de un envio (ADR 0061): el valor de la variable `estado` que manda
 * el FORMULARIO, tal como llego, con el hecho de agendar aplicado (`con_calendly`).
 *
 * ⚠️ **Es texto y no un tipo cerrado desde el ticket 117.** Fue el enum
 * `calificacion_envio` con tres valores fijos (ADR 0054), y el 29-sep una edicion del
 * Typeform de un programa dejo de mandarlos: ningun envio abrio deal por horas, sin un solo
 * error. Que significa cada valor —si abre deal, en que etapa, con que prioridad— lo dice
 * la tabla `estados_llegada` del programa (`lib/ingesta/estados-llegada.ts`), no el codigo.
 *
 * El CRM NO califica ni deduce (decision A8): `estadoDesdeTexto` solo traduce las
 * etiquetas de la hoja a su valor, y el adaptador de Typeform solo aplica el hecho de
 * agendar. Nada en `lib/ingesta/` lee las respuestas para decidir un Estado.
 */
export type Calificacion = string;

/**
 * El unico valor que el CODIGO pone (ADR 0061 punto 4): la respuesta de la pregunta de
 * agenda trae un link de Calendly. Es un HECHO, no una regla de negocio; a que etapa
 * lleva lo sigue diciendo su fila en `estados_llegada`.
 */
export const ESTADO_CON_CALENDLY = "con_calendly";
