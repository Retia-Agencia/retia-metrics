/**
 * El vocabulario del Hub (ticket 374, ADR 0115 N4): UN nombre por cifra.
 * Cada métrica tiene clave, nombre corto (tarjetas, columnas), nombre largo (títulos, listas) y una línea
 * de definición (tooltip). Las pantallas del Hub y sus listas toman el rótulo de aquí, nunca de un literal.
 * Alineado con `docs/overview.md` §11 y `docs/metricas.md`. "Monto" y "Contratado" no existen: se dice
 * Vendido, Recaudado, Por cobrar o Entró a caja, según la pregunta (369: las tres primeras sobre las mismas ventas).
 */
export type ClaveDeMetrica =
  | "registros" | "leads" | "deals_desde_completo" | "deals_desde_parcial"
  | "agendadas" | "citas" | "shows" | "no_asistio" | "llamadas_sin_resultado"
  | "ventas" | "vendido" | "recaudado" | "por_cobrar" | "entro_a_caja"
  | "nacio_agenda_del_dia" | "nacio_seguimiento" | "nacio_sin_llamada"
  | "comision" | "meta" | "esperado_a_hoy" | "faltan" | "por_dia_habil" | "proyeccion";

export type EntradaDeVocabulario = { corto: string; largo: string; definicion: string };

export const VOCABULARIO: Record<ClaveDeMetrica, EntradaDeVocabulario> = {
  registros: { corto: "Registros", largo: "Registros del formulario", definicion: "Cada vez que alguien llenó el formulario, completo o parcial." },
  leads: { corto: "Leads", largo: "Leads (personas)", definicion: "Personas distintas del programa; la misma persona cuenta una vez." },
  deals_desde_completo: { corto: "Deals (completo)", largo: "Deals creados desde un formulario completo", definicion: "Oportunidades abiertas por un registro que terminó el formulario." },
  deals_desde_parcial: { corto: "Deals (parcial)", largo: "Deals creados desde un formulario parcial", definicion: "Oportunidades abiertas por un registro que dejó el formulario a medias." },
  agendadas: { corto: "Agendadas", largo: "Citas agendadas en el periodo", definicion: "Citas creadas en el periodo, vengan para cuando vengan." },
  citas: { corto: "Citas", largo: "Citas vigentes", definicion: "Reservas reales en Calendly que no fueron canceladas." },
  shows: { corto: "Shows", largo: "Citas a las que asistieron", definicion: "Citas ocurridas con llamada atendida." },
  no_asistio: { corto: "No asistió", largo: "Citas a las que no asistieron", definicion: "Citas ocurridas sin llamada atendida." },
  llamadas_sin_resultado: { corto: "Sin resultado", largo: "Llamadas sin resultado", definicion: "Citas que ya ocurrieron y el closer no marcó como atendidas ni como no asistidas." },
  ventas: { corto: "Ventas", largo: "Ventas (cupos)", definicion: "Deals en Abonado o Completo; cada uno es un cupo." },
  vendido: { corto: "Vendido", largo: "Valor vendido", definicion: "Suma del valor vendido que el closer escribió en cada venta." },
  recaudado: { corto: "Recaudado", largo: "Recaudado de lo vendido", definicion: "Lo abonado, a hoy, a las ventas elegidas, sin importar cuándo se abonó." },
  por_cobrar: { corto: "Por cobrar", largo: "Por cobrar de lo vendido", definicion: "Lo vendido menos lo recaudado en las ventas elegidas; un sobrepago no resta deuda a otra venta." },
  entro_a_caja: { corto: "Entró a caja", largo: "Entró a caja", definicion: "Abonos vigentes con fecha en el periodo, de cualquier venta, por moneda y sin convertir." },
  nacio_agenda_del_dia: { corto: "Agenda del día", largo: "Venta nacida de una agenda del día", definicion: "La persona tuvo su llamada el mismo día en que entró a venta." },
  nacio_seguimiento: { corto: "Seguimiento", largo: "Venta nacida de un seguimiento", definicion: "Su última llamada fue un día anterior a la venta." },
  nacio_sin_llamada: { corto: "Sin llamada", largo: "Venta sin llamada realizada", definicion: "Ninguna llamada realizada hasta el día de la venta." },
  comision: { corto: "Comisión", largo: "Comisión del closer", definicion: "Porcentaje pactado sobre lo vendido." },
  meta: { corto: "Meta", largo: "Meta de la cohorte", definicion: "Cupos que se quieren vender en la cohorte." },
  esperado_a_hoy: { corto: "Esperado a hoy", largo: "Esperado a hoy", definicion: "Ventas que la meta pedía haber cerrado a esta fecha." },
  faltan: { corto: "Faltan", largo: "Cupos que faltan", definicion: "Meta menos ventas de la cohorte." },
  por_dia_habil: { corto: "Por día hábil", largo: "Por día hábil que queda", definicion: "Cupos que faltan repartidos entre los días hábiles que quedan." },
  proyeccion: { corto: "Proyección", largo: "Proyección de la cohorte", definicion: "Ventas esperadas al cierre si se mantiene el ritmo actual." },
};

export function nombreCorto(clave: ClaveDeMetrica): string { return VOCABULARIO[clave].corto; }
export function nombreLargo(clave: ClaveDeMetrica): string { return VOCABULARIO[clave].largo; }
export function definicion(clave: ClaveDeMetrica): string { return VOCABULARIO[clave].definicion; }

/** El rótulo de la columna de dinero de una lista, según la métrica que la abrió: nunca "Monto". */
export function rotuloDeImporte(metrica: string): string {
  if (metrica === "caja") return "Abono";
  return nombreCorto("vendido");
}

/** Palabras que ninguna cadena visible del Hub puede traer; las caza `tests/hub-vocabulario-guardian.test.ts`. */
export const JERGA_PROHIBIDA_EN_EL_HUB = ["Monto", "Contratado", "utm_", "macro", "periodo A", "periodo B"] as const;
