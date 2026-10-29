/**
 * El `utm_campaign` de una pieza de contenido (ADR 0108). Puro y sin base, para que el
 * formulario de media pueda previsualizar el MISMO valor que arma el servidor: dos copias de
 * esta regla darian una vista previa que no coincide con el link real.
 */
export function campanaDePieza(p: {
  tipo: string;
  creadorSlug: string;
  fechaPublicacion: string | null;
  permanente: boolean;
}): string {
  const fecha = !p.permanente && p.fechaPublicacion ? p.fechaPublicacion.replaceAll("-", "") : null;
  return [p.tipo, p.creadorSlug, fecha].filter((x): x is string => Boolean(x)).join("_");
}
