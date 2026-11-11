/**
 * Las dos vistas de Hub › Pauta (420, diseño §0 punto 3 y DM-5): Resultados, lo que reemplaza al Excel, y Origen y
 * calidad, de dónde vienen las ventas y qué llega mal. Comparten los filtros; la vista vive en `?vista=`.
 * Un valor que no es una vista vuelve a Resultados, igual que la pestaña del Hub vuelve a Hoy.
 */
export const VISTAS_DE_PAUTA = [
  { id: "resultados", etiqueta: "Resultados", descripcion: "Cómo va la cohorte, el costo por agenda, la tabla semanal y el ROAS." },
  { id: "calidad", etiqueta: "Origen y calidad", descripcion: "Qué trae ventas, qué llega sin origen y dónde se va la gente del formulario." },
] as const;

export type VistaDePauta = (typeof VISTAS_DE_PAUTA)[number]["id"];

export function vistaDePauta(valor: string | string[] | undefined): VistaDePauta {
  return VISTAS_DE_PAUTA.find((vista) => vista.id === valor)?.id ?? "resultados";
}

/**
 * La línea gris bajo los filtros de Pauta (diseño §3): lo que se está viendo, en palabras. "Viendo ComunicArte, cohorte C6,
 * 12 oct 2026 a 10 nov 2026, comparado con 12 sep 2026 a 11 oct 2026. Un programa a la vez: nunca se mezclan."
 */
export function resumenDeFiltrosDePauta(f: {
  programa: string;
  cohorte: string | null;
  rango: { desde: string; hasta: string };
  comparacion: { desde: string; hasta: string } | null;
  closer: string | null;
  escribirFecha: (dia: string) => string;
}): string {
  const rango = (r: { desde: string; hasta: string }) => r.desde === r.hasta ? f.escribirFecha(r.desde) : `${f.escribirFecha(r.desde)} a ${f.escribirFecha(r.hasta)}`;
  const partes = [`Viendo ${f.programa}`, f.cohorte ? `cohorte ${f.cohorte}` : "todas las cohortes", rango(f.rango)];
  if (f.closer) partes.push(`solo ${f.closer}`);
  if (f.comparacion) partes.push(`comparado con ${rango(f.comparacion)}`);
  return `${partes.join(", ")}. Un programa a la vez: nunca se mezclan.`;
}
