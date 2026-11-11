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
