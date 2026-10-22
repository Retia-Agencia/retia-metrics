/**
 * La última vista del Kanban de cada persona (ADR 0103), en una cookie del navegador como el
 * programa preferido. La escribe `proxy.ts` cuando la URL del tablero trae `vista`; la lee la
 * página, que la valida con la lista de `lib/deals/etapas.ts` (aquí no entra: el proxy no carga
 * el esquema). Es una comodidad, no un permiso: una cookie inválida cae en la vista por defecto.
 */
export const COOKIE_VISTA_DEL_TABLERO = "vista_tablero_deals";

export function vistaParaRecordar(pathname: string, searchParams: URLSearchParams): string | null {
  if (!/^\/p\/[^/]+\/deals\/?$/.test(pathname)) return null;
  const vista = searchParams.get("vista");
  return vista && /^[a-z]{1,20}$/.test(vista) ? vista : null;
}
