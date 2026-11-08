import type { CriterioDeCloser } from "@/lib/metricas/registro";

export const ETIQUETA_CRITERIO_DE_CLOSER: Record<CriterioDeCloser, string> = {
  quien_tomo_la_llamada: "por quien tomó la llamada",
  dueno_del_deal: "por el dueño del deal",
  quien_registro_el_abono: "por quien registró el abono",
};
