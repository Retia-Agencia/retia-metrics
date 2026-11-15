import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * La huella de una cita de Calendly en `calls.huella_fila`. Se arma y se lee aqui y en ningun otro lado:
 * el guardian de `tests/calendly-colgar-guardian.test.ts` caza el prefijo escrito a mano fuera de los escritores.
 */
const PREFIJO = "calendly:";

export const huellaDeCita = (uuidInvitado: string) => `${PREFIJO}${uuidInvitado}`;

/** El uuid del invitado de una huella de Calendly; nulo si la llamada no salio de Calendly. */
export function uuidDeHuella(huella: string | null | undefined): string | null {
  return huella?.startsWith(PREFIJO) ? huella.slice(PREFIJO.length) : null;
}

/**
 * Gemela SQL de `uuidDeHuella`: ambas derivan el UUID con el mismo prefijo.
 * El `case` conserva el `null` de la funcion TS para huellas que no son de Calendly.
 */
export function uuidDeHuellaSql(columna: SQLWrapper): SQL<string | null> {
  return sql<string | null>`case
    when ${columna} like ${`${PREFIJO}%`}
      then substr(${columna}, length(${PREFIJO}) + 1)
  end`;
}
