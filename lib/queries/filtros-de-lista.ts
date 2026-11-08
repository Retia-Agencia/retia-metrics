import { z } from "zod";
import { ETAPAS_EN_ORDEN } from "@/lib/deals/etapas";
import { BUCKETS_DE_ANTIGUEDAD, esMetricaDeEmbudo } from "@/lib/queries/embudo-con-filas";
import { PASOS_DE_CONVERSION } from "@/lib/queries/embudo-etapas";
import { ESCALONES, GRUPOS_DE_CIERRE } from "@/lib/queries/escalera";
import type { Metrica } from "@/lib/queries/metricas-con-filas";

export const METRICAS_DE_LISTA = [
  "caja", "agendas", "canceladas", "citas_debidas", "citas_sin_marcar", "shows", "no_shows",
  "shows_sin_grain", "cierres", "cortesias", "leads", "deals_creados", "deals_que_agendaron",
  "deals_desde_completo", "deals_desde_parcial", "completos_que_agendaron", "parciales_que_agendaron",
  "agendas_creadas", "registros", "agendas_futuras", "contratado", "sin_resultado", "atendidos_sin_valor",
  "atendidos_sin_grain", "grupo_citas", "grupo_shows", "grupo_vendidos", "grupo_sin_show",
  "grupo_pendientes", "embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_shows",
  "embudo_comercial_compraron", "etapa_entraron", "etapa_paso", "etapa_siguen", "etapa_perdidos",
  "etapa_otros", "etapa_tiempo", "etapa_abiertos", "etapa_sin_dueno", "no_agendaron", "pauta_meta", "escalera",
] as const satisfies readonly Metrica[];

type Iguales<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Exigir<T extends true> = T;
type _MetricasCubiertasEnAmbasDirecciones = Exigir<
  Iguales<Metrica, (typeof METRICAS_DE_LISTA)[number]>
>;

export const camposDeFiltrosDeLista = {
  etapa: z.enum([...new Set([...ETAPAS_EN_ORDEN, ...PASOS_DE_CONVERSION, "ganado"])] as [string, ...string[]]).optional(),
  antiguedad: z.enum(BUCKETS_DE_ANTIGUEDAD as [string, ...string[]]).optional(),
  closer: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  moneda: z.string().regex(/^[A-Z]{3}$/).optional(),
  origen: z.enum(["completo", "parcial", "manual"]).optional(),
  source: z.string().max(300).optional(),
  medium: z.string().max(300).optional(),
  categoria: z.enum(["con_utm", "sin_utm", "macro", "pieza_desconocida"]).optional(),
  area: z.enum(["paid", "organico", "referidos", "sin_utm"]).optional(),
  canal: z.string().max(300).optional(),
  campaign: z.string().max(300).optional(),
  resultado: z.enum(["show", "no_show"]).optional(),
  orden: z.enum(["envio", "actividad"]).optional(),
  escalon: z.enum([...ESCALONES, "ventas", "despues", "cita_sin_resultado"]).optional(),
  grupo: z.enum(Object.keys(GRUPOS_DE_CIERRE) as [keyof typeof GRUPOS_DE_CIERRE, ...(keyof typeof GRUPOS_DE_CIERRE)[]]).optional(),
  pago: z.enum(["completo", "parcial"]).optional(),
  calidad: z.string().max(100).optional(),
  nivel: z.enum(["campana", "conjunto", "anuncio", "anuncio_sin_identificar", "sin_anuncio", "total"]).optional(),
  id: z.string().max(100).optional(),
  paso: z.enum(["registro", "agenda", "show", "no_show", "venta"]).optional(),
};

const esquemaDeFiltros = z.object({
  metrica: z.enum(METRICAS_DE_LISTA),
  ...camposDeFiltrosDeLista,
});

export type FiltrosDeLista = z.infer<typeof esquemaDeFiltros>;

export function tipoDeLista({ metrica, source, medium, campaign, categoria }: FiltrosDeLista) {
  const tieneOrigen = source !== undefined || medium !== undefined || campaign !== undefined || categoria !== undefined;
  const esListaDePauta = metrica === "pauta_meta";
  const esListaDeOrigen = metrica === "registros" || metrica === "agendas_creadas"
    || (metrica === "escalera" && tieneOrigen);
  return { tieneOrigen, esListaDePauta, esListaDeOrigen };
}

/** Qué subconjunto exige cada métrica del embudo: sin él, la lista no existe. */
const SUBCONJUNTO_DEL_EMBUDO = {
  etapa_entraron: null,
  etapa_paso: "etapa",
  etapa_siguen: "etapa",
  etapa_perdidos: "etapa",
  etapa_otros: "etapa",
  etapa_tiempo: "etapa",
  etapa_abiertos: "etapa",
  etapa_sin_dueno: "antiguedad",
} as const;

export function combinacionDeFiltrosValida(filtros: FiltrosDeLista, { esAdmin }: { esAdmin: boolean }): boolean {
  const { metrica, resultado, area, canal, pago, source, medium, campaign, categoria, closer, orden, nivel, id, paso, escalon, grupo, calidad, moneda, origen, etapa, antiguedad } = filtros;
  const { esListaDePauta, esListaDeOrigen } = tipoDeLista(filtros);
  if (resultado !== undefined && metrica !== "agendas_creadas") return false;
  if (metrica === "escalera" && (area !== undefined || canal !== undefined)) return false;
  if (pago !== undefined && metrica !== "escalera") return false;
  if (!esListaDeOrigen && metrica !== "escalera" && (source !== undefined || medium !== undefined || campaign !== undefined || categoria !== undefined || area !== undefined || canal !== undefined)) return false;
  if (esListaDeOrigen && !esAdmin && closer !== undefined) return false;
  if (esListaDePauta && closer !== undefined) return false;
  if (metrica !== "no_agendaron" && orden !== undefined) return false;
  if (metrica === "pauta_meta" ? (!nivel || !paso || ((nivel === "sin_anuncio" || nivel === "total") ? id !== undefined : id === undefined)) : (nivel !== undefined || id !== undefined || paso !== undefined)) return false;
  if (metrica !== "escalera" && (escalon !== undefined || grupo !== undefined || calidad !== undefined)) return false;
  if (escalon !== undefined && grupo !== undefined) return false;
  if (moneda && metrica !== "caja") return false;
  if (origen && !metrica.startsWith("embudo_comercial_")) return false;
  const pide = esMetricaDeEmbudo(metrica) ? SUBCONJUNTO_DEL_EMBUDO[metrica] : null;
  return (pide === "etapa") === (etapa !== undefined)
    && (pide === "antiguedad") === (antiguedad !== undefined);
}

export function normalizarFiltrosDeOrigen<T extends Pick<FiltrosDeLista, "source" | "medium" | "canal" | "campaign">>(filtros: T) {
  return {
    source: filtros.source === "__null__" ? null : filtros.source,
    medium: filtros.medium === "__null__" ? null : filtros.medium,
    canal: filtros.canal === "__null__" ? null : filtros.canal,
    campaign: filtros.campaign === "__null__" ? null : filtros.campaign,
  };
}
