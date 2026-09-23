import { z } from "zod";
import { calificacionEnvioEnum } from "@/lib/db/schema";
import { normalizarTexto } from "@/lib/sheets/mapeo";

/**
 * La calificacion de un envio (T2) y su puntaje (T4). Son DOS preguntas distintas y
 * viven juntas solo porque leen las mismas respuestas con la misma configuracion:
 *
 * - **La calificacion es un HECHO del formulario:** ¿respondio la pregunta de pago?,
 *   ¿dijo que no tiene recursos?, ¿agendo? Decide a donde va el lead. Son las cuatro
 *   reglas del Apps Script de la hoja, en el mismo orden, porque con el webhook ya no hay
 *   hoja que las aplique (T2, 22-sep).
 * - **El puntaje es una ESTIMACION:** que tan bueno es el lead, para ordenar la cola. No
 *   cambia la calificacion: un lead que agendo sigue con agenda aunque puntue bajo.
 *
 * Todo sale de `sources.calificacion`, por fuente, porque las preguntas son de cada
 * formulario: el texto de la pregunta de pago lleva el precio del programa, y las escalas
 * de ingreso cambian entre formularios (medido el 23-sep: uno de los programas mezcla dos
 * escalas en la misma columna). Por eso el puntaje se asigna **por texto de respuesta** y
 * nunca interpretando un numero dentro del texto.
 *
 * 🩸 Los pesos del puntaje NO viven en el codigo y no se inventan: una cifra con pesos a
 * ojo se ve igual que una calibrada, y a los closers se les pide trabajar segun ella. Sin
 * `puntaje` en la configuracion, el envio queda sin puntaje, que es lo honesto.
 */

/** Los valores de la calificacion. El codigo decide con ellos (el 052 crea deals segun esto). */
export const CALIFICACIONES = calificacionEnvioEnum.enumValues;
export type Calificacion = (typeof CALIFICACIONES)[number];

export const esquemaCalificacion = z.object({
  /** Encabezado de la pregunta "¿estas dispuesto a invertir...?". Vacia = incompleto. */
  preguntaPago: z.string().trim().min(1),
  /** Respuestas de esa pregunta que descartan por falta de recursos. */
  respuestasSinRecursos: z.array(z.string().trim().min(1)).min(1),
  /** Encabezado del campo que trae el link de agenda (Calendly). */
  campoAgenda: z.string().trim().min(1),
  puntaje: z
    .object({
      /**
       * Sube cada vez que cambian los pesos. Se guarda en cada envio: si los pesos cambian
       * en noviembre, sigue sabiendose con que reglas se puntuo lo que el closer tenia al
       * frente en octubre.
       */
      version: z.number().int().positive(),
      reglas: z
        .array(
          z.object({
            pregunta: z.string().trim().min(1),
            respuesta: z.string().trim().min(1),
            puntos: z.number().int(),
          }),
        )
        .min(1),
    })
    .optional(),
});

export type ConfigCalificacion = z.infer<typeof esquemaCalificacion>;

export type ResultadoCalificacion =
  | {
      ok: true;
      calificacion: Calificacion;
      puntaje: number | null;
      versionPuntaje: number | null;
      /**
       * Preguntas de los pesos que el envio no trae. Si hay alguna, el puntaje queda NULO
       * en vez de sumar cero por ella: un puntaje bajo por una pregunta renombrada se ve
       * igual que un lead flojo.
       */
      faltanParaPuntaje: string[];
    }
  /**
   * La configuracion nombra una pregunta que el envio NO trae. No es "respuesta vacia": es
   * una configuracion que no casa con el formulario. Tratarlo como vacio mandaria a TODOS
   * los leads a `incompleto` sin un solo error, asi que se reporta.
   */
  | { ok: false; faltan: string[] };

/** Busca una respuesta por encabezado, sin acentos ni mayusculas. `undefined` = no existe. */
function responder(respuestas: Record<string, string | null>, encabezado: string): string | null | undefined {
  const buscado = normalizarTexto(encabezado);
  for (const [llave, valor] of Object.entries(respuestas)) {
    if (normalizarTexto(llave) === buscado) return valor;
  }
  return undefined;
}

export function calificarEnvio(
  respuestas: Record<string, string | null>,
  config: ConfigCalificacion,
): ResultadoCalificacion {
  const pago = responder(respuestas, config.preguntaPago);
  const agenda = responder(respuestas, config.campoAgenda);
  const faltan = [
    ...(pago === undefined ? [config.preguntaPago] : []),
    ...(agenda === undefined ? [config.campoAgenda] : []),
  ];
  if (faltan.length > 0) return { ok: false, faltan };

  const sinRecursos = new Set(config.respuestasSinRecursos.map(normalizarTexto));
  const calificacion: Calificacion = !pago
    ? "incompleto"
    : sinRecursos.has(normalizarTexto(pago))
      ? "sin_recursos"
      : agenda
        ? "con_agenda"
        : "setteo";

  const sinPuntaje = { ok: true as const, calificacion, puntaje: null, versionPuntaje: null };
  if (!config.puntaje) return { ...sinPuntaje, faltanParaPuntaje: [] };

  let puntaje = 0;
  const faltanParaPuntaje = new Set<string>();
  for (const regla of config.puntaje.reglas) {
    const valor = responder(respuestas, regla.pregunta);
    if (valor === undefined) faltanParaPuntaje.add(regla.pregunta);
    else if (valor && normalizarTexto(valor) === normalizarTexto(regla.respuesta)) puntaje += regla.puntos;
  }
  if (faltanParaPuntaje.size > 0) return { ...sinPuntaje, faltanParaPuntaje: [...faltanParaPuntaje] };
  return { ok: true, calificacion, puntaje, versionPuntaje: config.puntaje.version, faltanParaPuntaje: [] };
}
