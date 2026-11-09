import { DEFINICION_METRICAS_OBJETIVO, type MetricaObjetivo } from "./metricas";

export type ColorDeObjetivo = "exito" | "alerta" | "peligro";

export function colorDeObjetivo({
  metrica,
  meta,
  aceptable,
  valor,
}: {
  metrica: MetricaObjetivo;
  meta: number;
  aceptable: number | null;
  valor: number;
}): ColorDeObjetivo {
  const menorEsMejor = DEFINICION_METRICAS_OBJETIVO[metrica].sentido === "menor_es_mejor";
  const cumpleMeta = menorEsMejor ? valor <= meta : valor >= meta;
  if (cumpleMeta) return "exito";
  if (aceptable === null) return "peligro";
  const cumpleAceptable = menorEsMejor ? valor <= aceptable : valor >= aceptable;
  return cumpleAceptable ? "alerta" : "peligro";
}

