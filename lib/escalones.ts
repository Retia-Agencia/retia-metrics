/** Catálogo puro de la escalera comercial; seguro para módulos cliente. */
export const ESCALONES = [
  "pago_en_llamada",
  "pago_rapido",
  "pago_despues",
  "pago_sin_llamada",
  "atendio_no_compro",
  "agendo_no_se_presento",
  "dejo_datos",
] as const;
export type Escalon = (typeof ESCALONES)[number];

export const GRUPOS_DE_CIERRE = {
  cerro_en_la_llamada: ["pago_en_llamada"],
  cerro_con_seguimiento: ["pago_rapido", "pago_despues"],
  no_cerro: ["atendio_no_compro"],
  ventas_sin_llamada: ["pago_sin_llamada"],
  no_llegaron_a_la_llamada: ["agendo_no_se_presento", "dejo_datos"],
} as const satisfies Record<string, readonly Escalon[]>;
export type GrupoDeCierre = keyof typeof GRUPOS_DE_CIERRE;

export const NOMBRE_DE_ESCALON: Record<Escalon, string> = {
  pago_en_llamada: "Pagó en la llamada",
  pago_rapido: "Pagó rápido",
  pago_despues: "Pagó después",
  pago_sin_llamada: "Pagó sin llamada registrada",
  atendio_no_compro: "Atendió y no compró",
  agendo_no_se_presento: "Agendó y no se presentó",
  dejo_datos: "Dejó datos y sin cita ocurrida",
};

export const NOMBRE_DE_GRUPO_DE_CIERRE: Record<GrupoDeCierre, string> = {
  cerro_en_la_llamada: "Cerró en la llamada",
  cerro_con_seguimiento: "Cerró con seguimiento",
  no_cerro: "No cerró",
  ventas_sin_llamada: "Ventas sin llamada registrada",
  no_llegaron_a_la_llamada: "No llegaron a la llamada",
};
