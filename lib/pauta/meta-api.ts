import { ErrorDeApp } from "@/lib/errors";

const META_BASE = "https://graph.facebook.com/v26.0";
export const EVENTO_AGENDA_META = "invitee_meeting_scheduled";
export const CAMPOS_CAMPANA_META = "id,name,effective_status,objective";
export const CAMPOS_CONJUNTO_META = "id,name,effective_status,campaign_id,promoted_object";
export const CAMPOS_ANUNCIO_META = "id,name,effective_status,adset_id,campaign_id,url_tags,updated_time";
export const ESTADOS_ADS_META = [
  "ACTIVE", "PAUSED", "DELETED", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED",
  "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ARCHIVED", "ADSET_PAUSED", "IN_PROCESS",
  "WITH_ISSUES",
] as const;
export const ESTADOS_ADSETS_META = [
  "ACTIVE", "PAUSED", "DELETED", "CAMPAIGN_PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES",
] as const;
export const ESTADOS_CAMPAIGNS_META = [
  "ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES",
] as const;

type FetchMeta = typeof globalThis.fetch;

type RespuestaMeta<T> = T & {
  error?: { message?: unknown; code?: unknown };
};

/**
 * Meta rechaza una página que pesa demasiado con el código 1 y este texto, sin subcódigo. El
 * peso depende de cuántos anuncios y qué tan grandes son sus creativos, así que crece solo.
 */
const PEDIDO_DEMASIADO_GRANDE = /reduce the amount of data/i;
const LIMITE_MINIMO_POR_PAGINA = 5;

class PaginaDemasiadoGrandeError extends ErrorDeApp {}

interface PaginaMeta<T> {
  data?: T[];
  paging?: { next?: unknown };
}

const TIEMPO_MAXIMO_META_MS = 30_000;

function mensajeSeguro(mensaje: unknown, token: string): string {
  const texto = typeof mensaje === "string" && mensaje.trim() ? mensaje : "respuesta inválida";
  return texto.replaceAll(token, "(oculto)");
}

async function consultar<T>(url: URL, token: string, f: FetchMeta): Promise<RespuestaMeta<T>> {
  // Meta suele incluir `access_token` en `paging.next`; se elimina antes de volver a
  // consultar porque el único transporte permitido del secreto es el header.
  url.searchParams.delete("access_token");
  // Sin tope, una llamada colgada de Meta agota los 300 s de la función y el semáforo
  // de Juanito no llega (21:00 del 14-nov). 30 s sobran para una página de Meta.
  const respuesta = await f(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_META_MS),
  });
  let cuerpo: RespuestaMeta<T> | null = null;
  try {
    cuerpo = (await respuesta.json()) as RespuestaMeta<T>;
  } catch {
    // La respuesta no JSON se traduce abajo al mismo contrato seguro de Meta.
  }
  if (!respuesta.ok || cuerpo?.error) {
    const detalle = cuerpo?.error?.message ?? respuesta.statusText;
    const mensaje = `Meta rechazó la consulta: ${mensajeSeguro(detalle, token)}`;
    if (cuerpo?.error?.code === 1 && typeof detalle === "string" && PEDIDO_DEMASIADO_GRANDE.test(detalle)) {
      throw new PaginaDemasiadoGrandeError(mensaje, 422);
    }
    throw new ErrorDeApp(mensaje, 422);
  }
  if (!cuerpo) throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
  return cuerpo;
}

async function consultarPaginas<T>(url: URL, token: string, f: FetchMeta): Promise<T[]> {
  const filas: T[] = [];
  let siguiente: URL | null = url;
  while (siguiente) {
    let cuerpo: RespuestaMeta<PaginaMeta<T>>;
    try {
      cuerpo = await consultar(siguiente, token, f);
    } catch (error) {
      // La misma página (mismo cursor) se vuelve a pedir con la mitad de filas, hasta el mínimo:
      // medido el 14-oct, una cuenta con creativos pesados rechaza 100 anuncios y acepta 50.
      const limite = Number(siguiente.searchParams.get("limit"));
      if (!(error instanceof PaginaDemasiadoGrandeError) || !(limite > LIMITE_MINIMO_POR_PAGINA)) throw error;
      siguiente.searchParams.set("limit", String(Math.max(LIMITE_MINIMO_POR_PAGINA, Math.floor(limite / 2))));
      continue;
    }
    if (!Array.isArray(cuerpo.data)) {
      throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
    }
    filas.push(...cuerpo.data);
    siguiente = typeof cuerpo.paging?.next === "string" ? new URL(cuerpo.paging.next) : null;
  }
  return filas;
}

/** Objetos concretos por id, incluyendo todos los estados que el borde omite por defecto. */
export async function objetosPorId(
  cuentaIdMeta: string,
  borde: "campaigns" | "adsets" | "ads",
  ids: readonly string[],
  fields: string,
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<Record<string, unknown>[]> {
  const objetos: Record<string, unknown>[] = [];
  const estados = borde === "ads"
    ? ESTADOS_ADS_META
    : borde === "adsets"
      ? ESTADOS_ADSETS_META
      : ESTADOS_CAMPAIGNS_META;
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL(`${META_BASE}/act_${cuentaIdMeta}/${borde}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "50");
    url.searchParams.set("filtering", JSON.stringify([
      { field: "id", operator: "IN", value: ids.slice(i, i + 50) },
      { field: "effective_status", operator: "IN", value: estados },
    ]));
    objetos.push(...await consultarPaginas<Record<string, unknown>>(url, token, f));
  }
  return objetos;
}

export interface EstadoDeCuentaMeta {
  accountStatus: number;
  disableReason: number;
  amountSpent: number;
  spendCap: number;
}

/** Estado de pago de una cuenta concreta; no usa el listado incompleto de cuentas visibles. */
export async function estadoDeCuenta(
  idMeta: string,
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<EstadoDeCuentaMeta> {
  const url = new URL(`${META_BASE}/act_${idMeta}`);
  url.searchParams.set("fields", "account_status,disable_reason,amount_spent,spend_cap");
  const cuerpo = await consultar<{
    account_status?: unknown;
    disable_reason?: unknown;
    amount_spent?: unknown;
    spend_cap?: unknown;
  }>(url, token, f);
  if (typeof cuerpo.account_status !== "number") {
    throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
  }
  return {
    accountStatus: cuerpo.account_status,
    disableReason: Number(cuerpo.disable_reason ?? 0),
    amountSpent: Number(cuerpo.amount_spent ?? 0),
    spendCap: Number(cuerpo.spend_cap ?? 0),
  };
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

export interface ObjetoDePautaMeta {
  idMeta: string;
  nivel: "campana" | "conjunto" | "anuncio";
  padreIdMeta: string | null;
  nombre: string;
  estado: string;
  objetivo: string | null;
  eventoOptimizacion: string | null;
  formato: "video" | "imagen" | "carrusel" | null;
  urlTags: string | null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

function formatoCreativo(creativo: unknown): ObjetoDePautaMeta["formato"] {
  if (!creativo || typeof creativo !== "object") return null;
  const c = creativo as {
    object_type?: unknown;
    video_id?: unknown;
    asset_feed_spec?: { images?: unknown; videos?: unknown };
  };
  const tipo = texto(c.object_type)?.toUpperCase();
  if (tipo === "VIDEO" || texto(c.video_id) || Array.isArray(c.asset_feed_spec?.videos)) return "video";
  if (tipo === "CAROUSEL" || tipo === "MULTI_SHARE") return "carrusel";
  if (
    tipo === "PHOTO" ||
    tipo === "IMAGE" ||
    (tipo === "SHARE" && Array.isArray(c.asset_feed_spec?.images))
  ) return "imagen";
  return null;
}

export interface AnuncioConocido {
  actualizadoEn: Date;
  formato: ObjetoDePautaMeta["formato"];
  urlTags: string | null;
}

/** Anuncios nuevos, sin fecha legible o modificados en Meta desde la copia local. */
export function anunciosQueNecesitanCreativo(
  anuncios: readonly Record<string, unknown>[],
  conocidos: ReadonlyMap<string, AnuncioConocido>,
): string[] {
  return anuncios.flatMap((anuncio) => {
    const id = texto(anuncio.id);
    if (!id) return [];
    const conocido = conocidos.get(id);
    const actualizadoEn = typeof anuncio.updated_time === "string"
      ? new Date(anuncio.updated_time)
      : null;
    return !conocido || !actualizadoEn || Number.isNaN(actualizadoEn.getTime())
      || actualizadoEn > conocido.actualizadoEn
      ? [id]
      : [];
  });
}

export interface CreativoDeAnuncio {
  formato: ObjetoDePautaMeta["formato"];
  urlTagsDelCreativo: string | null;
}

/** Creativos de anuncios concretos, en lotes que Meta puede responder sin exceder el peso. */
export async function creativosDeAnuncios(
  cuentaIdMeta: string,
  idsAnuncio: readonly string[],
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<Map<string, CreativoDeAnuncio>> {
  if (idsAnuncio.length === 0) return new Map();
  const lotes: string[][] = [];
  for (let i = 0; i < idsAnuncio.length; i += 50) lotes.push(idsAnuncio.slice(i, i + 50));
  const respuestas: Record<string, unknown>[][] = [];
  for (const ids of lotes) {
    const url = new URL(`${META_BASE}/act_${cuentaIdMeta}/ads`);
    url.searchParams.set("fields", "id,creative{object_type,video_id,asset_feed_spec,url_tags}");
    url.searchParams.set("limit", "50");
    url.searchParams.set("filtering", JSON.stringify([{ field: "id", operator: "IN", value: ids }]));
    respuestas.push(await consultarPaginas<Record<string, unknown>>(url, token, f));
  }
  return new Map(respuestas.flat().map((fila) => {
    const id = texto(fila.id);
    if (!id) throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
    const creativo = fila.creative && typeof fila.creative === "object"
      ? fila.creative as Record<string, unknown>
      : {};
    return [id, {
      formato: formatoCreativo(creativo),
      urlTagsDelCreativo: texto(creativo.url_tags),
    }];
  }));
}

function exigirBase(fila: Record<string, unknown>): { id: string; nombre: string; estado: string } {
  const id = texto(fila.id);
  const nombre = texto(fila.name);
  const estado = texto(fila.effective_status);
  if (!id || !nombre || !estado) {
    throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
  }
  return { id, nombre, estado };
}

/** Mapeo único de las respuestas del árbol y de las búsquedas puntuales por id. */
export function mapearObjetosDePauta(
  nivel: ObjetoDePautaMeta["nivel"],
  filas: readonly Record<string, unknown>[],
  conocidos: ReadonlyMap<string, AnuncioConocido> = new Map(),
  creativos: ReadonlyMap<string, CreativoDeAnuncio> = new Map(),
): ObjetoDePautaMeta[] {
  return filas.map((fila) => {
    const b = exigirBase(fila);
    if (nivel === "campana") {
      return { idMeta: b.id, nivel, padreIdMeta: null, nombre: b.nombre,
        estado: b.estado, objetivo: texto(fila.objective), eventoOptimizacion: null,
        formato: null, urlTags: null };
    }
    const padre = texto(nivel === "conjunto" ? fila.campaign_id : fila.adset_id);
    if (!padre) throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
    if (nivel === "conjunto") {
      const promovido = fila.promoted_object && typeof fila.promoted_object === "object"
        ? fila.promoted_object as Record<string, unknown>
        : {};
      return { idMeta: b.id, nivel, padreIdMeta: padre, nombre: b.nombre,
        estado: b.estado, objetivo: null,
        eventoOptimizacion: texto(promovido.custom_event_str) ?? texto(promovido.custom_event_type),
        formato: null, urlTags: null };
    }
    const conocido = conocidos.get(b.id);
    const creativo = creativos.get(b.id);
    return { idMeta: b.id, nivel, padreIdMeta: padre, nombre: b.nombre,
      estado: b.estado, objetivo: null, eventoOptimizacion: null,
      formato: creativo ? creativo.formato : conocido?.formato ?? null,
      urlTags: texto(fila.url_tags)
        ?? (creativo ? creativo.urlTagsDelCreativo : conocido?.urlTags ?? null) };
  });
}

/** Árbol completo de campañas, conjuntos y anuncios visibles en una cuenta. */
export async function arbolDeCuenta(
  idMeta: string,
  token: string,
  conocidos: ReadonlyMap<string, AnuncioConocido>,
  f: FetchMeta = globalThis.fetch,
): Promise<ObjetoDePautaMeta[]> {
  const base = `${META_BASE}/act_${idMeta}`;
  const url = (borde: string, fields: string) => {
    const u = new URL(`${base}/${borde}`);
    u.searchParams.set("fields", fields);
    u.searchParams.set("limit", "500");
    return u;
  };
  const [campanas, conjuntos, anuncios] = await Promise.all([
    consultarPaginas<Record<string, unknown>>(
      url("campaigns", CAMPOS_CAMPANA_META), token, f,
    ),
    consultarPaginas<Record<string, unknown>>(
      url("adsets", CAMPOS_CONJUNTO_META), token, f,
    ),
    consultarPaginas<Record<string, unknown>>(
      url("ads", CAMPOS_ANUNCIO_META),
      token,
      f,
    ),
  ]);
  const creativos = await creativosDeAnuncios(
    idMeta,
    anunciosQueNecesitanCreativo(anuncios, conocidos),
    token,
    f,
  );

  return [
    ...mapearObjetosDePauta("campana", campanas),
    ...mapearObjetosDePauta("conjunto", conjuntos),
    ...mapearObjetosDePauta("anuncio", anuncios, conocidos, creativos),
  ];
}

export interface InsightDeAnuncioMeta {
  adId: string;
  monto: string;
  fecha: string;
  agendas: number | null;
  registros: number | null;
  impresiones: number | null;
  alcance: number | null;
  clicsEnlace: number | null;
  vistasLanding: number | null;
}

/** Meta manda los números como texto; ausente o ilegible es null, nunca 0. */
function enteroOpcional(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function valorDeAccion(acciones: unknown, tipo: string): number | null {
  if (!Array.isArray(acciones)) return null;
  const accion = acciones.find((a) => a && typeof a === "object" &&
    (a as { action_type?: unknown }).action_type === tipo);
  return accion ? enteroOpcional((accion as { value?: unknown }).value) : null;
}

const ACCION_VISTA_LANDING = "landing_page_view";
const ACCION_REGISTRO_COMPLETO = "offsite_conversion.fb_pixel_complete_registration";

/** Gasto y conversiones reportados por Meta, con grano anuncio × día. */
export async function insightsPorAnuncioYDia(
  idMeta: string,
  desde: string,
  hasta: string,
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<InsightDeAnuncioMeta[]> {
  const url = new URL(`${META_BASE}/act_${idMeta}/insights`);
  url.searchParams.set("level", "ad");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: desde, until: hasta }));
  url.searchParams.set("fields", "ad_id,spend,date_start,conversions,actions,impressions,reach,inline_link_clicks");
  url.searchParams.set("limit", "500");
  const filas = await consultarPaginas<Record<string, unknown>>(url, token, f);
  return filas.map((fila) => {
    const adId = texto(fila.ad_id);
    const monto = texto(fila.spend);
    const fecha = texto(fila.date_start);
    if (!adId || !monto || !fecha) {
      throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
    }
    const conversion = Array.isArray(fila.conversions)
      ? fila.conversions.find((c) => c && typeof c === "object" &&
        (c as { action_type?: unknown }).action_type ===
          `offsite_conversion.fb_pixel_custom.${EVENTO_AGENDA_META}`)
      : undefined;
    const valor = conversion && typeof conversion === "object"
      ? Number((conversion as { value?: unknown }).value)
      : Number.NaN;
    const accionRegistro = Array.isArray(fila.actions)
      ? fila.actions.find((accion) => accion && typeof accion === "object" &&
        (accion as { action_type?: unknown }).action_type === ACCION_REGISTRO_COMPLETO)
      : undefined;
    const registros = accionRegistro && typeof accionRegistro === "object"
      ? Number((accionRegistro as { value?: unknown }).value)
      : Number.NaN;
    return {
      adId,
      monto,
      fecha,
      agendas: Number.isFinite(valor) ? valor : null,
      registros: Number.isFinite(registros) ? registros : null,
      impresiones: enteroOpcional(fila.impressions),
      alcance: enteroOpcional(fila.reach),
      clicsEnlace: enteroOpcional(fila.inline_link_clicks),
      vistasLanding: valorDeAccion(fila.actions, ACCION_VISTA_LANDING),
    };
  });
}

/** Gasto diario que Meta atribuye a una cuenta, en la moneda propia de esa cuenta. */
export async function gastoDiarioDeCuenta(
  idMeta: string,
  desde: string,
  hasta: string,
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<Map<string, string>> {
  const url = new URL(`${META_BASE}/act_${idMeta}/insights`);
  url.searchParams.set("level", "account");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since: desde, until: hasta }));
  url.searchParams.set("fields", "spend,date_start");
  url.searchParams.set("limit", "500");
  const filas = await consultarPaginas<Record<string, unknown>>(url, token, f);
  return new Map(filas.map((fila) => {
    const fecha = texto(fila.date_start);
    const monto = texto(fila.spend);
    if (!fecha || !monto || !Number.isFinite(Number(monto))) {
      throw new ErrorDeApp("Meta rechazó la consulta: respuesta inválida", 422);
    }
    return [fecha, monto];
  }));
}
