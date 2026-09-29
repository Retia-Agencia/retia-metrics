import { inArray } from "drizzle-orm";
import { programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { BASE, coleccionCompleta, ErrorDeCalendly, organizacionDelToken, type FetchLike } from "./cita";

/**
 * Las cuentas de Calendly de la organizacion de un programa (ticket 096), leidas con el
 * token del programa (rol owner, ADR 0057): `GET /organization_memberships`.
 *
 * Sirven para vincular cada membresia (closer × programa) con SU cuenta sin que nadie
 * escriba un correo: el administrador elige de esta lista, y el servidor vuelve a
 * comprobar contra ella antes de guardar. Esa cuenta decide de quien es un deal (la host
 * se lo queda), asi que un correo tecleado mal —o una cuenta ajena— moveria deals sin un
 * solo error.
 *
 * Un fallo de la API lanza `ErrorDeCalendly`, nunca una lista vacia silenciosa: "no hay
 * cuentas" y "el token vencio" no pueden verse igual.
 */

export interface CuentaDeCalendly {
  nombre: string | null;
  /** En minusculas y sin espacios: la forma con la que se compara y se guarda. */
  correo: string;
}

export async function cuentasDeCalendly({
  token,
  fetch: fetchInyectado,
}: {
  token: string;
  fetch?: FetchLike;
}): Promise<CuentaDeCalendly[]> {
  const fetchImpl = fetchInyectado ?? (globalThis.fetch as unknown as FetchLike);
  if (!fetchImpl) throw new ErrorDeCalendly("No hay implementación de fetch disponible.");

  const organizacion = await organizacionDelToken(fetchImpl, token);
  const miembros = await coleccionCompleta(
    fetchImpl,
    `${BASE}/organization_memberships?organization=${encodeURIComponent(organizacion)}&count=100`,
    token,
    "miembros de la organización",
  );

  const porCorreo = new Map<string, CuentaDeCalendly>();
  for (const m of miembros) {
    const usuario = typeof m === "object" && m !== null ? (m as { user?: unknown }).user : null;
    if (typeof usuario !== "object" || usuario === null) continue;
    const { email, name } = usuario as { email?: unknown; name?: unknown };
    if (typeof email !== "string" || !email.includes("@")) continue;
    const correo = email.trim().toLowerCase();
    porCorreo.set(correo, { correo, nombre: typeof name === "string" && name.trim() ? name.trim() : null });
  }
  return [...porCorreo.values()].sort((a, b) => (a.nombre ?? a.correo).localeCompare(b.nombre ?? b.correo, "es"));
}

/** Lo que la pantalla recibe por programa: la lista, o por que no la hay. Nunca el token. */
export type CuentasDelPrograma = { ok: true; cuentas: CuentaDeCalendly[] } | { ok: false; error: string };

/**
 * Las cuentas de Calendly de varios programas, en paralelo y FUERA de toda transaccion.
 * Un programa sin token o con el token rechazado devuelve su error, sin tumbar a los demas.
 */
export async function cuentasPorPrograma(
  db: Db,
  programIds: readonly string[],
  opciones: { fetch?: FetchLike } = {},
): Promise<Record<string, CuentasDelPrograma>> {
  if (programIds.length === 0) return {};
  const filas = await db
    .select({ id: programs.id, token: programs.calendlyToken })
    .from(programs)
    .where(inArray(programs.id, [...programIds]));

  const pares = await Promise.all(
    filas.map(async (p): Promise<[string, CuentasDelPrograma]> => {
      if (!p.token) return [p.id, { ok: false, error: "El programa no tiene token de Calendly." }];
      try {
        return [p.id, { ok: true, cuentas: await cuentasDeCalendly({ token: p.token, fetch: opciones.fetch }) }];
      } catch (e) {
        if (e instanceof ErrorDeCalendly) return [p.id, { ok: false, error: e.message }];
        throw e;
      }
    }),
  );
  return Object.fromEntries(pares);
}
