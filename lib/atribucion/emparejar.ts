import { normalizarUtm, resolverCanal, UTM_MEDIUM_CONTENIDO, type ResultadoCanal } from "@/lib/atribucion/canal";
import { esMacro, utmsDelEnvio, type CampoUtm, type UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

export interface ArbolDePauta {
  anuncios: readonly { id: string; conjuntoId: string; campanaId: string }[];
  conjuntos: readonly { id: string; campanaId: string }[];
  campanas: readonly { id: string; nombre: string }[];
}

export const ARBOL_VACIO: ArbolDePauta = { anuncios: [], conjuntos: [], campanas: [] };

/**
 * Las piezas de contenido como DATO, igual que el arbol de Meta (ADR 0108 punto 4). Solo las usa
 * el medio `contenido`. El programa del envio viaja con ellas: una pieza de otro programa no
 * empareja (ADR 0043). Sin este argumento el emparejador no resuelve piezas ni avisa.
 */
export interface PiezasDelPrograma {
  programId: string;
  piezas: readonly { id: string; codigo: string; creadorId: string; programId: string | null; anulada: boolean }[];
}

type Campana = { tipo: "meta"; campanaId: string } | { tipo: "texto"; texto: string };
type Anuncio = { anuncioId: string; conjuntoId: string; campanaId: string };
type Conjunto = { conjuntoId: string; campanaId: string };
type Hallazgo =
  | { nivel: 3; orden: number; anuncio: ArbolDePauta["anuncios"][number] }
  | { nivel: 2; orden: number; conjunto: ArbolDePauta["conjuntos"][number] }
  | { nivel: 1; orden: number; campana: ArbolDePauta["campanas"][number] };
type Contenido =
  | { formato: "plantilla_pauta"; anuncioNombre: string | null; placement: string | null }
  | { formato: "meta_historico"; conjunto: string | null; anuncio: string | null }
  | { formato: "closer"; codigoCloser: string | null }
  | { formato: "pieza"; codigo: string | null };

export interface Traza {
  origen: ResultadoCanal;
  nivel: "N3" | "N2" | "N1" | "N0";
  campana: Campana | null;
  conjunto: Conjunto | null;
  anuncio: Anuncio | null;
  contenido: Contenido | null;
  macros: CampoUtm[];
  /** La pieza de contenido a la que resolvio el codigo de `utm_content` (solo con `utm_medium=contenido`). */
  pieza: { piezaId: string; creadorId: string } | null;
  avisos: ("anuncio_desconocido" | "campana_ambigua" | "pieza_desconocida")[];
}

const CAMPOS_UTM: readonly CampoUtm[] = ["source", "medium", "campaign", "content", "term", "id"];

function valorAtribuible(valor: string | null): string | null {
  if (valor === null || esMacro(valor)) return null;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/** Empareja un envio de forma pura, estable y sin depender de catalogos. */
export function emparejar(utms: UtmsDelEnvio, arbol: ArbolDePauta, piezas?: PiezasDelPrograma): Traza {
  const macros = CAMPOS_UTM.filter((campo) => esMacro(utms[campo]));
  const origenPorMedio = resolverCanal(utms);
  const medium = normalizarUtm(utms.medium);
  const avisos: Traza["avisos"] = [];

  const ids = [utms.idsMeta.adId, utms.id, utms.idsMeta.adsetId, utms.idsMeta.campaignId]
    .map(valorAtribuible)
    .filter((id): id is string => id !== null);
  const hallazgos: Hallazgo[] = [];
  ids.forEach((id, orden) => {
    const anuncio = arbol.anuncios.find((candidato) => candidato.id === id);
    if (anuncio) {
      hallazgos.push({ nivel: 3, orden, anuncio });
      return;
    }
    const conjunto = arbol.conjuntos.find((candidato) => candidato.id === id);
    if (conjunto) {
      hallazgos.push({ nivel: 2, orden, conjunto });
      return;
    }
    const campana = arbol.campanas.find((candidata) => candidata.id === id);
    if (campana) hallazgos.push({ nivel: 1, orden, campana });
  });
  const hallado = hallazgos.sort((a, b) => b.nivel - a.nivel || a.orden - b.orden)[0];
  const anuncio = hallado && "anuncio" in hallado
    ? { anuncioId: hallado.anuncio.id, conjuntoId: hallado.anuncio.conjuntoId, campanaId: hallado.anuncio.campanaId }
    : null;
  const conjunto = anuncio !== null
    ? { conjuntoId: anuncio.conjuntoId, campanaId: anuncio.campanaId }
    : hallado && "conjunto" in hallado
      ? { conjuntoId: hallado.conjunto.id, campanaId: hallado.conjunto.campanaId }
      : null;
  // Los ids de Meta son numéricos: un texto como `organic` (lo mandan los links orgánicos en
  // `ad_id`) es un centinela, no un anuncio que falte en el árbol.
  if (ids.some((id) => /^\d+$/.test(id)) && hallado === undefined) avisos.push("anuncio_desconocido");

  const origen: ResultadoCanal = hallado === undefined
    ? origenPorMedio
    : { ...origenPorMedio, area: "paid", regla: "id_en_arbol" };
  const esMeta = origen.area === "paid";

  let campana: Campana | null = anuncio !== null
    ? { tipo: "meta", campanaId: anuncio.campanaId }
    : conjunto !== null
      ? { tipo: "meta", campanaId: conjunto.campanaId }
      : hallado && "campana" in hallado
        ? { tipo: "meta", campanaId: hallado.campana.id }
        : null;
  const campaign = valorAtribuible(utms.campaign);
  if (campana === null && esMeta && campaign !== null) {
    const coincidencias = arbol.campanas
      .filter((candidata) => candidata.nombre.trim().toLowerCase() === campaign.toLowerCase());
    if (coincidencias.length === 1) campana = { tipo: "meta", campanaId: coincidencias[0].id };
    if (coincidencias.length > 1) avisos.push("campana_ambigua");
  } else if (campana === null && origen.regla !== "sin_utm" && campaign !== null) {
    campana = { tipo: "texto", texto: campaign };
  }

  const content = valorAtribuible(utms.content);
  const term = valorAtribuible(utms.term);
  let contenido: Contenido | null = null;
  if (medium === "paid_social") {
    contenido = { formato: "plantilla_pauta", anuncioNombre: content, placement: term };
  } else if (medium === "cpc") {
    contenido = { formato: "meta_historico", conjunto: content, anuncio: term };
  } else if (medium === "referido") {
    contenido = { formato: "closer", codigoCloser: content };
  } else if (medium === UTM_MEDIUM_CONTENIDO) {
    contenido = { formato: "pieza", codigo: content };
  }

  // La pieza se deriva al leer (ADR 0108): codigo -> pieza viva del MISMO programa. Un codigo
  // que no existe, una pieza descartada o de otro programa es un aviso, nunca una asignacion.
  let pieza: Traza["pieza"] = null;
  if (medium === UTM_MEDIUM_CONTENIDO && piezas !== undefined) {
    const codigo = content?.toLowerCase() ?? null;
    const hallada = codigo === null ? undefined : piezas.piezas.find((p) => p.codigo.toLowerCase() === codigo);
    if (hallada && !hallada.anulada && hallada.programId === piezas.programId) {
      pieza = { piezaId: hallada.id, creadorId: hallada.creadorId };
    } else {
      avisos.push("pieza_desconocida");
    }
  }

  const nivel = origen.regla === "sin_utm"
    ? "N0"
    : anuncio !== null
      ? "N3"
      : conjunto !== null || campana !== null
        ? "N2"
        : "N1";

  return { origen, nivel, campana, conjunto, anuncio, contenido, macros, pieza, avisos };
}

/** Mantiene la lectura de content/term encapsulada dentro del límite de atribución. */
export function emparejarFilaDeEnvio(
  fila: Parameters<typeof utmsDelEnvio>[0],
  arbol: ArbolDePauta,
  piezas?: PiezasDelPrograma,
): Traza {
  return emparejar(utmsDelEnvio(fila), arbol, piezas);
}
