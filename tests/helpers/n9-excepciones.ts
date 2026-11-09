/**
 * Trinquete de la regla N9 (ADR 0115): los tickets históricos que hoy incumplen, anteriores a la regla.
 * Cada entrada es `"<id>:<regla>"` (R1 casillas sin marcar en un done, R2 marca del tracker distinta del status,
 * R3 ticket sin fila). `tests/tracker-n9-guardian.test.ts` exige que cada una siga incumpliendo (si deja de
 * hacerlo, se BORRA de aquí) y que `TOPE_DE_EXCEPCIONES` sea igual a la longitud: la lista solo encoge.
 * Un ticket nuevo no entra aquí: se cierra bien.
 */
export const EXCEPCIONES_HISTORICAS: readonly string[] = [
  "007:R1", "016:R1", "036:R1", "037:R1", "038:R1", "039:R1",
  "040:R1", "041:R1", "043:R1", "044:R1", "045:R1", "046:R1",
  "047:R1", "048:R1", "049:R1", "050:R1", "051:R1", "061:R1",
  "062:R1", "065:R1", "066:R1", "068:R1", "069:R1", "070:R1",
  "071:R1", "072:R1", "074:R1", "076:R1", "077:R1", "079:R1",
  "086:R1", "088:R1", "092:R1", "094:R1", "098:R1", "103:R1",
  "108:R1", "110:R1", "112:R1", "113:R1", "117:R1", "119:R1",
  "122:R1", "133:R1", "158:R3", "169:R1", "207:R1", "209:R1",
  "210:R1", "211:R1", "215:R1", "216:R1", "217:R1", "218:R1",
  "219:R1", "220:R1", "221:R1", "222:R1", "223:R1", "225:R1",
  "226:R1", "227:R1", "228:R1", "229:R1", "230:R1", "231:R1",
  "234:R1", "235:R1", "238:R1", "239:R1", "240:R1", "241:R1",
  "244:R1", "245:R1", "246:R1", "255:R1", "259:R1", "260:R1",
  "264:R1", "265:R1", "269:R1", "310:R1",
];

/** Baja al borrar una excepción; subirlo es una decisión que se ve en el diff. */
export const TOPE_DE_EXCEPCIONES = 82;
