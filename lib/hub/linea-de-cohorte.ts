import { fechaCorta, NOMBRES_DE_MES } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";

/**
 * Los dos textos que acompañan al filtro Cohorte del Hub (377, G-2) y la regla del vacío del cruce
 * Cohorte × Periodo (N5). Puros: la página les pasa los hechos ya leídos y los tests los recorren.
 */

export interface DatosDeLaLinea {
  /** La cohorte elegida; `null` = "Todas". */
  cohorte: { codigo: string; metaCupos: number; inicioVentas: string | null; cierreVentas: string | null } | null;
  /** El día de cada venta real de la cohorte (o del programa con "Todas"). */
  ventas: readonly { dia: string }[];
}

/**
 * "C3 · se vende del 1-oct al 30-nov · primera venta: 3-oct · última: 2-nov · 32 vendidos de 50".
 * Las fechas de venta salen de la cohorte; la primera y la última, de las ventas reales (una venta
 * anterior al inicio de ventas cuenta y la línea lo dice, C-08).
 */
export function lineaDeLaCohorte({ cohorte, ventas }: DatosDeLaLinea): string {
  const dias = ventas.map((v) => v.dia).sort();
  const primera = dias[0];
  const ultima = dias[dias.length - 1];
  if (!cohorte) {
    return primera
      ? `Todas las cohortes · primera venta del programa: ${fechaCorta(primera)}`
      : "Todas las cohortes · aún sin ventas";
  }
  const partes = [cohorte.codigo];
  partes.push(
    cohorte.inicioVentas && cohorte.cierreVentas
      ? `se vende del ${fechaCorta(cohorte.inicioVentas)} al ${fechaCorta(cohorte.cierreVentas)}`
      : "sin fechas de venta definidas",
  );
  if (!primera || !ultima) {
    partes.push("aún sin ventas");
    return partes.join(" · ");
  }
  partes.push(`primera venta: ${fechaCorta(primera)}`, `última: ${fechaCorta(ultima)}`);
  partes.push(`${dias.length} vendidos de ${cohorte.metaCupos}`);
  const antes = cohorte.inicioVentas ? dias.filter((d) => d < cohorte.inicioVentas!).length : 0;
  if (antes > 0) {
    partes.push(`${antes} ${antes === 1 ? "venta anterior" : "ventas anteriores"} al inicio de ventas`);
  }
  return partes.join(" · ");
}

/** El periodo dicho como complemento de frase: "en octubre", "hoy", "entre el 1-oct y el 9-oct". */
export function periodoEnFrase(periodo: PeriodoResuelto): string {
  const { a, preset } = periodo;
  if (preset === "hoy") return "hoy";
  if (preset === "ayer") return "ayer";
  if (preset === "esta_semana") return "esta semana";
  if (preset === "semana_pasada") return "la semana pasada";
  if (preset === "desde_el_inicio") return "desde el inicio";
  if ((preset === "este_mes" || preset === "mes_pasado") && a.desde.slice(0, 7) === a.hasta.slice(0, 7)) {
    return `en ${NOMBRES_DE_MES[Number(a.desde.slice(5, 7)) - 1]}`;
  }
  return a.desde === a.hasta ? `el ${fechaCorta(a.desde)}` : `entre el ${fechaCorta(a.desde)} y el ${fechaCorta(a.hasta)}`;
}

/** Cohorte y periodo que no se tocan: se dice, no se pinta una pantalla de ceros (regla del vacío, N5). */
export function fraseSinActividad(codigoDeLaCohorte: string | null, periodo: PeriodoResuelto): string {
  const sujeto = codigoDeLaCohorte ?? "El programa";
  return `${sujeto} no tuvo actividad ${periodoEnFrase(periodo)}. Elige otro periodo o Desde el inicio.`;
}
