// Puro y sin base: lo importan el generador de links (servidor) y la vista previa del formulario de media (cliente).

/**
 * La forma de un valor libre (campana, content, term): minusculas, sin tildes, `snake_case`,
 * sin espacios (ADR 0051). Lo que no es letra o digito pasa a `_`, y los `_` de los bordes
 * se quitan. `source` y `medium` NO pasan por aqui: son los del Canal, y el emparejador los
 * compara contra ese catalogo; reescribirlos (un punto en `l.instagram.com`) romperia el par.
 */
export function sanearUtm(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
