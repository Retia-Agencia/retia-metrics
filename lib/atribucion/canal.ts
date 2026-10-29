import { esMacro } from "@/lib/atribucion/utm-del-envio";

export const AREAS = ["paid", "organico", "referidos", "sin_utm"] as const;
export type Area = (typeof AREAS)[number];

export const NOMBRE_DE_AREA: Record<Area, string> = {
  paid: "Paid",
  organico: "Orgánico",
  referidos: "Referidos",
  sin_utm: "Sin UTM",
};

export const MEDIOS_PAGOS = ["cpc", "paid_social", "paid"] as const;
export const UTM_SOURCE_CLOSER = "closer";
/** La fuente del link fijo de un creador cuando no pertenece a una red concreta. */
export const UTM_SOURCE_CREADOR = "creador";
export const UTM_MEDIUM_REFERIDO = "referido";
/** El medio del link de una pieza de contenido (ADR 0108): el emparejador decide con el. */
export const UTM_MEDIUM_CONTENIDO = "contenido";

export interface Canal {
  clave: string;
  nombre: string;
  plataforma: string;
  cuenta: string | null;
}

export type ResultadoCanal = {
  area: Area;
  canal: Canal | null;
  regla: "id_en_arbol" | "medio_pago" | "referido" | "con_utm" | "sin_utm";
};

/** Los vacíos y las macros sin expandir no son datos atribuibles. */
export function normalizarUtm(valor: string | null): string | null {
  if (valor === null) return null;
  const limpio = valor.trim();
  if (limpio === "" || esMacro(limpio)) return null;
  return limpio.toLowerCase();
}

const ALIAS_DE_PLATAFORMA: Readonly<Record<string, string>> = {
  ig: "instagram",
  fb: "facebook",
  an: "audience network",
  msg: "messenger",
  th: "threads",
};

function capitalizarPalabras(valor: string): string {
  return valor
    .split(" ")
    .map((palabra) => `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}`)
    .join(" ");
}

function canalDelSource(source: string | null): Canal | null {
  if (source === null) return null;
  const [primera, ...resto] = source.split(/\s+/);
  const plataforma = ALIAS_DE_PLATAFORMA[primera] ?? primera;
  const cuenta = resto.length > 0 ? resto.join(" ") : null;
  return {
    clave: cuenta === null ? plataforma : `${plataforma} ${cuenta}`,
    nombre: cuenta === null
      ? capitalizarPalabras(plataforma)
      : `${capitalizarPalabras(plataforma)} · ${capitalizarPalabras(cuenta)}`,
    plataforma,
    cuenta,
  };
}

/** Presenta una clave ya derivada sin volver a consultar un catálogo. */
export function nombreDeCanal(clave: string): string {
  const palabras = clave.split(" ");
  const plataformaLarga = palabras[0] === "audience" && palabras[1] === "network";
  const corte = plataformaLarga ? 2 : 1;
  const plataforma = palabras.slice(0, corte).join(" ");
  const cuenta = palabras.slice(corte).join(" ");
  return cuenta === ""
    ? capitalizarPalabras(plataforma)
    : `${capitalizarPalabras(plataforma)} · ${capitalizarPalabras(cuenta)}`;
}

/**
 * Resuelve el área y el canal de un envío solo con reglas de código.
 * El paso 1, `id_en_arbol`, lo aplica el emparejador porque necesita el árbol de pauta.
 */
export function resolverCanal(
  envio: { source: string | null; medium: string | null },
): ResultadoCanal {
  const source = normalizarUtm(envio.source);
  const medium = normalizarUtm(envio.medium);
  const canal = canalDelSource(source);

  if (medium !== null && (MEDIOS_PAGOS as readonly string[]).includes(medium)) {
    return { area: "paid", canal, regla: "medio_pago" };
  }
  if (medium === UTM_MEDIUM_REFERIDO) return { area: "referidos", canal, regla: "referido" };
  if (source !== null || medium !== null) return { area: "organico", canal, regla: "con_utm" };
  return { area: "sin_utm", canal: null, regla: "sin_utm" };
}

/** Explica la misma decisión de `resolverCanal`; no vuelve a clasificar el envío. */
export function textoDeRegla(
  resultado: ResultadoCanal,
  envio: { source: string | null; medium: string | null },
): string {
  switch (resultado.regla) {
    case "id_en_arbol": return "id encontrado en el árbol de Meta";
    case "medio_pago": return `medio pago: ${normalizarUtm(envio.medium) ?? "—"}`;
    case "referido": return "medio referido";
    case "con_utm": return "UTM presente: origen orgánico";
    case "sin_utm": return "sin source ni medium";
  }
}

/** Clasifica los `url_tags` de un anuncio sin sacar las llaves UTM de atribución. */
export function tipoDePlantilla(tags: string | null): "vieja" | "pauta" | "otra" | "sin_id" {
  const parametros = new URLSearchParams(tags ?? "");
  const source = parametros.get("utm_source")?.trim().toLowerCase();
  const medium = parametros.get("utm_medium")?.trim().toLowerCase();
  if (source === "facebook" && medium === "cpc" && parametros.has("ad_id")) return "vieja";
  if (medium === "paid_social" && parametros.has("utm_id")) return "pauta";
  if (!parametros.has("ad_id") && !parametros.has("utm_id")) return "sin_id";
  return "otra";
}
