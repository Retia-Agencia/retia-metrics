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

/**
 * Compara los cupos vendidos con el avance esperado. La fracción la calcula el llamador con
 * `lib/dias-habiles.ts`; esta función pura no conoce fechas ni base de datos.
 */
export function colorDeCupos({
  meta,
  aceptable,
  vendidos,
  fraccionTranscurrida,
}: {
  meta: number;
  aceptable: number | null;
  vendidos: number;
  fraccionTranscurrida: number;
}): ColorDeObjetivo {
  const fraccion = Math.min(Math.max(fraccionTranscurrida, 0), 1);
  return colorDeObjetivo({
    metrica: "cupos",
    meta: meta * fraccion,
    aceptable: aceptable === null ? null : aceptable * fraccion,
    valor: vendidos,
  });
}
