import { eq, inArray, type SQL, type SQLWrapper } from "drizzle-orm";
import { calls } from "@/lib/db/schema";

/**
 * Qué le pasó a una llamada, dicho UNA vez (ticket 353, ADR 0115 N1). "Ocurrió", "no asistió" y las tasas
 * de show y no show que salen de ahí se decidían en ocho envolturas sueltas sobre la misma lista y en cuatro
 * fórmulas con el mismo nombre; ahora la lista, el predicado en memoria, el predicado en SQL y los cocientes
 * viven aquí y nadie los reescribe (`tests/resultados-de-llamada.test.ts` lo vigila).
 */

/** Resultados que prueban que la llamada ocurrió, incluso cuando terminó perdida. */
export const RESULTADOS_QUE_OCURRIERON = ["show", "compromiso_pago", "cerrada", "perdida"] as const;

/** El único resultado que dice "agendó y no se presentó". La cancelada no es un no show: nadie dejó plantado a nadie. */
export const RESULTADO_NO_ASISTIO = "no_show" as const;

/** ¿Este resultado prueba que la llamada ocurrió? */
export function ocurrio(resultado: string): boolean {
  return (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(resultado);
}

/** ¿El closer marcó que la persona no se presentó? */
export function noAsistio(resultado: string): boolean {
  return resultado === RESULTADO_NO_ASISTIO;
}

/**
 * La gemela en memoria de `citaVencidaSinResultado` (`metricas-filtros.ts`, 353): sigue `agendada` y su hora
 * (`coalesce(fecha_agenda, fecha_llamada)`) ya llegó al corte, inclusive. Sin hora no hay cita vencida. Un dato que falta,
 * no un no show. Si cambia una, cambia la otra (`tests/resultados-de-llamada.test.ts` las compara).
 */
export function citaSinResultado(cita: { resultado: string; fechaAgenda: Date | null; fechaLlamada: Date | null }, ahora: Date): boolean {
  const hora = cita.fechaAgenda ?? cita.fechaLlamada;
  return cita.resultado === "agendada" && hora !== null && hora.getTime() <= ahora.getTime();
}

/** `ocurrio` en SQL, sobre `calls.resultado` o sobre otra columna de resultado. */
export function ocurrioSql(columna: SQLWrapper = calls.resultado): SQL {
  return inArray(columna as typeof calls.resultado, [...RESULTADOS_QUE_OCURRIERON]);
}

/** `noAsistio` en SQL. */
export function noAsistioSql(): SQL {
  return eq(calls.resultado, RESULTADO_NO_ASISTIO);
}

/** Los resultados que ocurrieron como lista de literales para una plantilla `sql.raw`. */
export function resultadosQueOcurrieronComoLiterales(): string {
  return RESULTADOS_QUE_OCURRIERON.map((resultado) => `'${resultado}'`).join(", ");
}

function dividir(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

/**
 * % de show POR DEAL (ADR 0079; la cifra de Hoy, DA-3): deals con al menos un show ÷ deals con resultado
 * marcado. Una reagenda no suma deals. `null` si no hay base.
 */
export function showPorDeal(dealsConShow: number, dealsConResultado: number): number | null {
  return dividir(dealsConShow, dealsConResultado);
}

/**
 * % de show POR CITA (dentro de "Cómo se calcula", DA-3): citas que ocurrieron ÷ citas vivas que ya debían
 * ocurrir. Es otra pregunta que `showPorDeal`: una persona con dos citas cuenta dos veces.
 */
export function showPorCita(realizadas: number, citasDebidas: number): number | null {
  return dividir(realizadas, citasDebidas);
}

/**
 * % de no show de citas RESUELTAS: no shows ÷ (ocurrieron + no shows). Es el complemento de `showPorCita`
 * medido solo sobre lo que el closer ya marcó: una cita sin resultado no es un no show.
 */
export function noShowPorCita(noShows: number, ocurridas: number): number | null {
  return dividir(noShows, ocurridas + noShows);
}

/** % de no show POR DEAL: deals con cita ocurrida y sin show ÷ deals con resultado marcado (complemento de `showPorDeal`). */
export function noShowPorDeal(dealsSinShow: number, dealsConResultado: number): number | null {
  return dividir(dealsSinShow, dealsConResultado);
}
