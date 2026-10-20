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
