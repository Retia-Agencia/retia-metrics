/**
 * La extraccion del cockpit (ticket 322, ADR 0111): lo que `extraer` lee de su base y
 * `importar` escribe en la del CRM. Son filas tal como las entrega el cockpit (sus nombres de
 * columna), porque el mapa al vocabulario del CRM lo hace el importador y en un solo lugar.
 */
export type FilaCockpit = Record<string, unknown>;

export const TABLAS_DEL_COCKPIT = [
  "voces",
  "proyectos",
  "referentes",
  "referentes_proyectos",
  "referentes_propuestos",
  "referentes_propuestos_proyectos",
  "candidatos",
  "calificados", // `outputs` de tipo `guion_reel`
  "descartes",
  "tandas",
  "transcripciones",
  "guiones_limpios",
  "colecciones",
  "colecciones_videos",
  "videos_meta",
  "grabados",
] as const;
export type TablaDelCockpit = (typeof TABLAS_DEL_COCKPIT)[number];

export interface ExtraccionCockpit {
  /** El `client_id` del cockpit que se extrajo (un tenant, nunca varios). */
  cliente: string;
  extraidoEn: string;
  tablas: Record<TablaDelCockpit, FilaCockpit[]>;
}
