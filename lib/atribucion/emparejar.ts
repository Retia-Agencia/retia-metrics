import { resolverCanal, type CanalActivo, type ResultadoCanal } from "@/lib/atribucion/canal";
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
  nivel: "N3" | "N2" | "N1" | "N0" | "sin_clasificar";
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

/** Empareja un envio de forma pura, estable y sin depender del orden de sus catalogos. */
export function emparejar(
  utms: UtmsDelEnvio,
  catalogo: readonly CanalActivo[],
  arbol: ArbolDePauta,
): Traza {
  const macros = CAMPOS_UTM.filter((campo) => esMacro(utms[campo]));
  const origen = resolverCanal(utms, catalogo);
  const canal = origen.tipo === "canal" ? origen.canal : null;
  const esMeta = canal?.formato === "plantilla_pauta" || canal?.formato === "meta_historico";
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
  } else if (campana === null && canal !== null && !esMeta && campaign !== null) {
    campana = { tipo: "texto", texto: campaign };
  }

  const content = valorAtribuible(utms.content);
  const term = valorAtribuible(utms.term);
  let contenido: Contenido | null = null;
  if (canal?.formato === "plantilla_pauta") {
    contenido = { formato: "plantilla_pauta", anuncioNombre: content, placement: term };
  } else if (canal?.formato === "meta_historico") {
    contenido = { formato: "meta_historico", conjunto: content, anuncio: term };
  } else if (canal?.formato === "closer") {
    contenido = { formato: "closer", codigoCloser: content };
  }

  const nivel =
    origen.tipo === "sin_utm"
      ? "N0"
      : origen.tipo === "sin_clasificar"
        ? "sin_clasificar"
        : anuncio !== null
          ? "N3"
          : campana !== null
            ? "N2"
            : "N1";

  return { origen, nivel, campana, anuncio, contenido, macros, avisos };
}
