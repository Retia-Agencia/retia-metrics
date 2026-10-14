import { normalizarUtm, resolverCanal, type ResultadoCanal } from "@/lib/atribucion/canal";
import { esMacro, type CampoUtm, type UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

export interface ArbolDePauta {
  anuncios: readonly { id: string; conjuntoId: string; campanaId: string }[];
  campanas: readonly { id: string; nombre: string }[];
}

export const ARBOL_VACIO: ArbolDePauta = { anuncios: [], campanas: [] };

type Campana = { tipo: "meta"; campanaId: string } | { tipo: "texto"; texto: string };
type Anuncio = { anuncioId: string; conjuntoId: string; campanaId: string };
type Contenido =
  | { formato: "plantilla_pauta"; anuncioNombre: string | null; placement: string | null }
  | { formato: "meta_historico"; conjunto: string | null; anuncio: string | null }
  | { formato: "closer"; codigoCloser: string | null };

export interface Traza {
  origen: ResultadoCanal;
  nivel: "N3" | "N2" | "N1" | "N0";
  campana: Campana | null;
  anuncio: Anuncio | null;
  contenido: Contenido | null;
  macros: CampoUtm[];
  avisos: ("anuncio_desconocido" | "campana_ambigua")[];
}

const CAMPOS_UTM: readonly CampoUtm[] = ["source", "medium", "campaign", "content", "term", "id"];

function valorAtribuible(valor: string | null): string | null {
  if (valor === null || esMacro(valor)) return null;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/** Empareja un envio de forma pura, estable y sin depender de catalogos. */
export function emparejar(utms: UtmsDelEnvio, arbol: ArbolDePauta): Traza {
  const macros = CAMPOS_UTM.filter((campo) => esMacro(utms[campo]));
  const origen = resolverCanal(utms);
  const esMeta = origen.area === "paid";
  const medium = normalizarUtm(utms.medium);
  const avisos: Traza["avisos"] = [];

  const id = valorAtribuible(utms.id);
  const hallado = id === null ? undefined : arbol.anuncios.find((candidato) => candidato.id === id);
  const anuncio = hallado
    ? { anuncioId: hallado.id, conjuntoId: hallado.conjuntoId, campanaId: hallado.campanaId }
    : null;
  if (id !== null && anuncio === null) avisos.push("anuncio_desconocido");

  let campana: Campana | null = anuncio === null ? null : { tipo: "meta", campanaId: anuncio.campanaId };
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
  }

  const nivel = origen.regla === "sin_utm"
    ? "N0"
    : anuncio !== null
      ? "N3"
      : campana !== null
        ? "N2"
        : "N1";

  return { origen, nivel, campana, anuncio, contenido, macros, avisos };
}
