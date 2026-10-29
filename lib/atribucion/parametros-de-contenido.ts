import { UTM_MEDIUM_CONTENIDO, UTM_SOURCE_CREADOR } from "./canal";

/**
 * Los parametros del link de una pieza (ADR 0108) escritos como DATO para mostrarse: nombre
 * legible, de donde sale y un ejemplo. Vive en `lib/atribucion/` porque nombra `utm_content`,
 * que solo ese directorio puede nombrar (ADR 0051); la pantalla de media solo lo pinta.
 * `canal.ts` arrastra la base: el cliente recibe esta lista por props y no importa este modulo.
 */
export interface ParametroDeContenido {
  llave: string;
  nombre: string;
  sale: string;
  ejemplo: string;
}

export function parametrosDeContenido(redes: readonly string[]): ParametroDeContenido[] {
  return [
    { llave: "utm_source", nombre: "Red", sale: `La red donde se publica la pieza; en un link fijo sin red es ${UTM_SOURCE_CREADOR}.`, ejemplo: `${redes.slice(0, 3).join(", ")} o ${UTM_SOURCE_CREADOR}` },
    { llave: "utm_medium", nombre: "Medio", sale: "Siempre el mismo: marca que es contenido de media. Nadie lo escribe.", ejemplo: UTM_MEDIUM_CONTENIDO },
    { llave: "utm_campaign", nombre: "Campaña", sale: "Tipo de pieza, creador y fecha, en ese orden. Los links fijos no llevan fecha.", ejemplo: "reel_milena_20261030" },
    { llave: "utm_content", nombre: "Código de la pieza", sale: "El código único de la pieza. Es lo que permite saber exactamente cuál fue.", ejemplo: "k7p2x9 (lo genera el CRM)" },
  ];
}

/** El link desglosado: cada parametro presente con su nombre legible, en el orden del contrato. */
export function desglosarLink(url: string, redes: readonly string[]): { nombre: string; valor: string }[] {
  const q = new URL(url).searchParams;
  return parametrosDeContenido(redes).flatMap((p) => {
    const valor = q.get(p.llave);
    return valor ? [{ nombre: p.nombre, valor }] : [];
  });
}
