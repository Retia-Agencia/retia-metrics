import { ErrorDeApp } from "@/lib/errors";

const META_BASE = "https://graph.facebook.com/v26.0";

type FetchMeta = typeof globalThis.fetch;

type RespuestaMeta<T> = T & {
  error?: { message?: unknown };
};

function mensajeSeguro(mensaje: unknown, token: string): string {
  const texto = typeof mensaje === "string" && mensaje.trim() ? mensaje : "respuesta inválida";
  return texto.replaceAll(token, "(oculto)");
}

async function consultar<T>(url: URL, token: string, f: FetchMeta): Promise<RespuestaMeta<T>> {
  // Meta suele incluir `access_token` en `paging.next`; se elimina antes de volver a
  // consultar porque el único transporte permitido del secreto es el header.
  url.searchParams.delete("access_token");
  const respuesta = await f(url, { headers: { Authorization: `Bearer ${token}` } });
  let cuerpo: RespuestaMeta<T> | null = null;
  try {
    cuerpo = (await respuesta.json()) as RespuestaMeta<T>;
  } catch {
    // La respuesta no JSON se traduce abajo al mismo contrato seguro de Meta.
  }
  if (!respuesta.ok || cuerpo?.error) {
    const detalle = cuerpo?.error?.message ?? respuesta.statusText;
    throw new ErrorDeApp(`Meta rechazó la consulta: ${mensajeSeguro(detalle, token)}`, 422);
  }
  if (!cuerpo) throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
  return cuerpo;
}

/** Nombre del usuario del sistema al que pertenece el token. */
export async function usuarioDelToken(
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<{ nombre: string }> {
  const url = new URL(`${META_BASE}/me`);
  url.searchParams.set("fields", "name");
  const cuerpo = await consultar<{ name?: unknown }>(url, token, f);
  if (typeof cuerpo.name !== "string" || !cuerpo.name.trim()) {
    throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
  }
  return { nombre: cuerpo.name };
}

export interface CuentaVisibleMeta {
  idMeta: string;
  nombre: string;
  moneda: string;
  zonaHoraria: string;
}

/** Todas las cuentas visibles para el token, recorriendo la paginación de Meta. */
export async function cuentasVisibles(
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<CuentaVisibleMeta[]> {
  let url: URL | null = new URL(`${META_BASE}/me/adaccounts`);
  url.searchParams.set("fields", "name,account_id,currency,timezone_name");
  url.searchParams.set("limit", "100");
  const cuentas: CuentaVisibleMeta[] = [];

  while (url) {
    const cuerpo: RespuestaMeta<{
      data?: Array<{
        account_id?: unknown;
        name?: unknown;
        currency?: unknown;
        timezone_name?: unknown;
      }>;
      paging?: { next?: unknown };
    }> = await consultar(url, token, f);
    if (!Array.isArray(cuerpo.data)) {
      throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
    }
    for (const cuenta of cuerpo.data) {
      if (
        typeof cuenta.account_id !== "string" ||
        typeof cuenta.name !== "string" ||
        typeof cuenta.currency !== "string" ||
        typeof cuenta.timezone_name !== "string"
      ) {
        throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
      }
      cuentas.push({
        idMeta: cuenta.account_id,
        nombre: cuenta.name,
        moneda: cuenta.currency,
        zonaHoraria: cuenta.timezone_name,
      });
    }
    url = typeof cuerpo.paging?.next === "string" ? new URL(cuerpo.paging.next) : null;
  }

  return cuentas;
}
