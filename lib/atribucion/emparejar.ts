import { normalizarUtm, resolverCanal, type ResultadoCanal } from "@/lib/atribucion/canal";
import { esMacro, type CampoUtm, type UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

export interface ArbolDePauta {
  anuncios: readonly { id: string; conjuntoId: string; campanaId: string }[];
  conjuntos: readonly { id: string; campanaId: string }[];
  campanas: readonly { id: string; nombre: string }[];
}

export const ARBOL_VACIO: ArbolDePauta = { anuncios: [], conjuntos: [], campanas: [] };

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
  | { formato: "closer"; codigoCloser: string | null };

export interface Traza {
  origen: ResultadoCanal;
  nivel: "N3" | "N2" | "N1" | "N0";
  campana: Campana | null;
  conjunto: Conjunto | null;
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
  if (ids.length > 0 && hallado === undefined) avisos.push("anuncio_desconocido");

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
  }

  const nivel = origen.regla === "sin_utm"
    ? "N0"
    : anuncio !== null
      ? "N3"
      : conjunto !== null || campana !== null
        ? "N2"
        : "N1";

  return { origen, nivel, campana, conjunto, anuncio, contenido, macros, avisos };
}
