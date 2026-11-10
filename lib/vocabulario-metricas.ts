/**
 * El vocabulario del Hub (ticket 374, ADR 0115 N4): UN nombre por cifra.
 * Cada métrica tiene clave, nombre corto (tarjetas, columnas), nombre largo (títulos, listas) y una línea
 * de definición (tooltip). Las pantallas del Hub y sus listas toman el rótulo de aquí, nunca de un literal.
 * Alineado con `docs/overview.md` §11 y `docs/metricas.md` (los rotulos visibles los fija el glosario del 397;
 * "Agendadas" aun no coincide con la tarjeta de citas por fecha de cita, H-27). "Monto" y "Contratado" no existen: se dice
 * Vendido, Recaudado, Por cobrar o Entró a caja, según la pregunta (369: las tres primeras sobre las mismas ventas).
 */
export type ClaveDeMetrica =
  | "registros" | "leads" | "deals_desde_completo" | "deals_desde_parcial"
  | "agendadas" | "citas" | "shows" | "show_por_cita" | "no_asistio" | "llamadas_sin_resultado"
  | "ventas" | "vendido" | "recaudado" | "por_cobrar" | "entro_a_caja" | "cupos_con_caja"
  | "nacio_agenda_del_dia" | "nacio_seguimiento" | "nacio_sin_llamada"
  | "comision" | "meta" | "esperado_a_hoy" | "faltan" | "por_dia_habil" | "proyeccion"
  // Hub › Hoy (378): los nombres que Mani pidió sin jerga. "Meta" queda solo para la plataforma de pauta.
  | "cupos_vendidos" | "objetivo_del_dia" | "objetivo_de_leads" | "leads_que_hacen_falta" | "llevamos"
  | "asistencia" | "cierre_de_ventas" | "cita_a_venta" | "citas_del_dia" | "citas_realizadas" | "citas_canceladas"
  | "citas_pendientes" | "objetivo_semana" | "objetivo_mes" | "objetivo_cohorte"
  | "dias_del_ritmo" | "citas_minimas";

/**
 * Por qué la agenda del CRM y la de Meta pueden diferir (DA-4, Mani, 7-nov; ticket 353). UN texto para el semáforo, el
 * mensaje de horas y "Cómo se calcula": la cifra del CRM es la cita creada en el CRM (cada reagenda es otra cita);
 * la de Meta se muestra aparte y no se corrige contra la otra.
 */
export const EXPLICACION_AGENDA_CRM_VS_META =
  "La agenda del CRM es la cita creada en el CRM, y cada reagenda cuenta como otra cita. La de Meta se muestra aparte: llega con atraso y se la atribuye al anuncio que vio la persona, aunque agende o compre después con otro enlace. Por eso pueden diferir.";

export type EntradaDeVocabulario = { corto: string; largo: string; definicion: string };

export const VOCABULARIO: Record<ClaveDeMetrica, EntradaDeVocabulario> = {
  registros: { corto: "Envíos", largo: "Envíos del formulario (completos y parciales)", definicion: "Cada formulario enviado, completo o parcial." },
  leads: { corto: "Leads", largo: "Leads (personas)", definicion: "Personas distintas del programa; la misma persona cuenta una vez." },
  deals_desde_completo: { corto: "Deals (completo)", largo: "Deals creados desde un formulario completo", definicion: "Oportunidades abiertas por un registro que terminó el formulario." },
  deals_desde_parcial: { corto: "Deals (parcial)", largo: "Deals creados desde un formulario parcial", definicion: "Oportunidades abiertas por un registro que dejó el formulario a medias." },
  agendadas: { corto: "Agendadas", largo: "Agendadas en el periodo", definicion: "Citas creadas en el periodo, vengan para cuando vengan." },
  citas: { corto: "Citas", largo: "Citas del periodo", definicion: "Citas cuya fecha cae en el periodo y no fueron canceladas." },
  shows: { corto: "Realizadas", largo: "Citas realizadas en el periodo", definicion: "Citas ocurridas en las que se atendió la llamada." },
  show_por_cita: { corto: "% de show por cita", largo: "% de show por cita", definicion: "Citas que ocurrieron ÷ citas vivas que ya debían ocurrir." },
  no_asistio: { corto: "No asistió", largo: "Citas a las que no asistieron", definicion: "Citas ocurridas sin llamada atendida." },
  llamadas_sin_resultado: { corto: "Sin resultado", largo: "Llamadas sin resultado", definicion: "Citas que ya ocurrieron y el closer no marcó como atendidas ni como no asistidas." },
  ventas: { corto: "Ventas", largo: "Ventas del periodo", definicion: "Deals en Abonado o Completo; cada uno es un cupo." },
  vendido: { corto: "Vendido", largo: "Valor vendido", definicion: "Suma del valor vendido que el closer escribió en cada venta." },
  recaudado: { corto: "Recaudado", largo: "Recaudado de lo vendido", definicion: "Lo abonado, a hoy, a las ventas elegidas, sin importar cuándo se abonó." },
  por_cobrar: { corto: "Por cobrar", largo: "Por cobrar de lo vendido", definicion: "Lo vendido menos lo recaudado en las ventas elegidas; un sobrepago no resta deuda a otra venta." },
  cupos_con_caja: { corto: "Cupos con caja", largo: "Cupos con al menos un abono", definicion: "Ventas con al menos un abono vigente en el periodo; cada una cuenta una vez, el día de su primer abono del periodo, aunque abone varias veces." },
  entro_a_caja: { corto: "Entró a caja", largo: "Entró a caja", definicion: "Abonos vigentes con fecha en el periodo, de cualquier venta, por moneda y sin convertir." },
  nacio_agenda_del_dia: { corto: "Agenda del día", largo: "Venta nacida de una agenda del día", definicion: "La persona tuvo su llamada el mismo día en que entró a venta." },
  nacio_seguimiento: { corto: "Seguimiento", largo: "Venta nacida de un seguimiento", definicion: "Su última llamada fue un día anterior a la venta." },
  nacio_sin_llamada: { corto: "Sin llamada", largo: "Venta sin llamada realizada", definicion: "Ninguna llamada realizada hasta el día de la venta." },
  comision: { corto: "Comisión", largo: "Comisión del closer", definicion: "Porcentaje pactado sobre lo vendido." },
  meta: { corto: "Objetivo", largo: "Objetivo de la cohorte", definicion: "Cupos que la empresa quiere vender en la cohorte." },
  esperado_a_hoy: { corto: "Esperado a hoy", largo: "Esperado a hoy", definicion: "Ventas que el objetivo pedía haber cerrado a esta fecha." },
  faltan: { corto: "Faltan", largo: "Cupos que faltan", definicion: "Objetivo menos ventas de la cohorte." },
  por_dia_habil: { corto: "Por día hábil", largo: "Por día hábil que queda", definicion: "Cupos que faltan repartidos entre los días hábiles que quedan." },
  proyeccion: { corto: "Proyección", largo: "Proyección de la cohorte", definicion: "Ventas esperadas al cierre si se mantiene el ritmo actual." },
  cupos_vendidos: { corto: "Cupos vendidos", largo: "Cupos vendidos hoy", definicion: "Ventas del día: cada una es un cupo." },
  objetivo_del_dia: { corto: "Objetivo del día", largo: "Objetivo de cupos del día", definicion: "Cupos que hay que vender hoy para ir al ritmo del objetivo del mes." },
  objetivo_de_leads: { corto: "Objetivo de leads", largo: "Objetivo de leads por día", definicion: "Leads por día que la cohorte se propuso conseguir; lo escribe una persona, no se calcula." },
  leads_que_hacen_falta: { corto: "Leads que hacen falta", largo: "Leads que hacen falta por día", definicion: "Cuántos leads por día se necesitan para llegar al objetivo de cupos, con las tasas que se miden hoy; se calcula, no se escribe." },
  llevamos: { corto: "Llevamos", largo: "Llevamos a hoy", definicion: "Lo acumulado desde que empezó el periodo hasta hoy." },
  asistencia: { corto: "Asistencia", largo: "Asistencia", definicion: "De las citas que ya debían ocurrir, cuántas se realizaron." },
  cierre_de_ventas: { corto: "Cierre de ventas", largo: "Cierre de ventas", definicion: "De las citas realizadas, cuántas terminaron en venta." },
  cita_a_venta: { corto: "De cita a venta", largo: "De cita a venta", definicion: "De las personas que agendaron cita en el periodo, cuántas terminaron en venta." },
  citas_del_dia: { corto: "Citas del día", largo: "Citas del día", definicion: "Citas con fecha de hoy, sin las canceladas." },
  citas_realizadas: { corto: "Realizadas", largo: "Citas realizadas hoy", definicion: "Citas de hoy en las que el closer atendió la llamada." },
  citas_canceladas: { corto: "Canceladas", largo: "Citas canceladas", definicion: "Citas de hoy que se cancelaron; no cuentan para la asistencia." },
  citas_pendientes: { corto: "Sin resultado", largo: "Citas sin resultado", definicion: "Citas cuya hora ya pasó y el closer no marcó cómo terminaron." },
  objetivo_semana: { corto: "Objetivo de la semana", largo: "Objetivo de cupos de la semana", definicion: "Parte del objetivo del mes que toca vender esta semana." },
  objetivo_mes: { corto: "Objetivo del mes", largo: "Objetivo de cupos del mes", definicion: "Cupos que la empresa quiere vender en el mes." },
  objetivo_cohorte: { corto: "Objetivo de la cohorte", largo: "Objetivo de cupos de la cohorte", definicion: "Cupos que la empresa quiere vender en toda la cohorte." },
  dias_del_ritmo: { corto: "Días para medir el ritmo", largo: "Días hábiles para medir el ritmo", definicion: "Cuántos días hábiles hacia atrás se miran para medir qué tan rápido se vende y cuántos leads se vuelven cita. Ejemplo: con 10, se miran las dos últimas semanas." },
  citas_minimas: { corto: "Mínimo para confiar en una tasa", largo: "Mínimo de personas para confiar en una tasa", definicion: "El % de asistencia necesita al menos este número de personas con cita atendida o no asistida, y el % de cierre este número de asistentes. Con menos, se usa la cohorte anterior o no se calcula. Ejemplo: con 20, una cohorte con 12 asistentes todavía no sirve." },
};

/** Nombres nuevos de la tabla semanal de Paid Media (412 B), aún fuera del registro tipado de conceptos. */
export const VOCABULARIO_PAUTA_SEMANAL = {
  inversion: "Inversión",
  costo_agenda_crm: "Costo por agenda",
  costo_agenda_meta: "Costo por agenda (según Meta)",
  roas: "ROAS",
  gasto: "Gasto",
  pct_no_asistio: "% no asistió",
  envios: nombreCorto("registros"),
  profit: "Profit",
  cpm: "CPM",
  ctr: "CTR",
  llegada_landing: "Llegada a la landing",
  conversion_landing: "Conversión de la landing",
  frecuencia: "Frecuencia",
  otras_campaignas: "Otras campañas",
} as const;

/**
 * Las claves de la tabla semanal de Pauta que son un CONCEPTO propio con ficha en el registro (403 F2). Viven en su
 * vocabulario (`VOCABULARIO_PAUTA_SEMANAL`) y no en `ClaveDeMetrica`: el Hub no las muestra, la Pauta sí. `gasto`,
 * `envios`, `pct_no_asistio` y `otras_campaignas` no son conceptos aparte (son una suma, otro concepto o un desglose).
 */
export type ClaveDePauta =
  | "inversion" | "costo_agenda_crm" | "costo_agenda_meta" | "roas" | "profit"
  | "cpm" | "ctr" | "llegada_landing" | "conversion_landing" | "frecuencia";

/** Toda clave que puede tener ficha: las del Hub y las de Pauta. Los nombres no se solapan (lo vigila el test del registro). */
export type ClaveDeConcepto = ClaveDeMetrica | ClaveDePauta;

/** El nombre corto de cualquier concepto registrable, del vocabulario que le toca. */
export function nombreDeConcepto(clave: ClaveDeConcepto): string {
  return clave in VOCABULARIO ? VOCABULARIO[clave as ClaveDeMetrica].corto : VOCABULARIO_PAUTA_SEMANAL[clave as ClaveDePauta];
}

export const UNIVERSO_PAUTA = "solo Paid";
export const UNIVERSO_COMERCIAL = "todas las áreas";

/** "Meta" sola es ambigua (pauta, empresa, objetivo): en pantalla es siempre Objetivo, y Meta solo la plataforma. */
export const PLATAFORMA_DE_PAUTA = "Meta";

export function nombreCorto(clave: ClaveDeMetrica): string { return VOCABULARIO[clave].corto; }
export function nombreLargo(clave: ClaveDeMetrica): string { return VOCABULARIO[clave].largo; }
export function definicion(clave: ClaveDeMetrica): string { return VOCABULARIO[clave].definicion; }

/** Los títulos de las listas del Hub: ninguna ruta vuelve a nombrar una cifra por su cuenta. */
export const TITULOS_DE_LISTA = {
  caja: nombreLargo("entro_a_caja"),
  agendas: nombreLargo("citas"),
  canceladas: nombreLargo("citas_canceladas"),
  shows: nombreLargo("shows"),
  no_shows: nombreLargo("no_asistio"),
  shows_sin_grain: "Realizadas sin Grain",
  cierres: nombreLargo("ventas"),
  cortesias: "Cortesías",
  leads: nombreLargo("leads"),
  deals_creados: "Deals creados",
  deals_que_agendaron: "Deals que agendaron",
  deals_desde_completo: nombreLargo("deals_desde_completo"),
  deals_desde_parcial: nombreLargo("deals_desde_parcial"),
  completos_que_agendaron: "Deals de un formulario completo que agendaron",
  parciales_que_agendaron: "Deals de un parcial que agendaron",
  agendas_creadas: nombreLargo("agendadas"),
  registros: nombreLargo("registros"),
  citas_debidas: "Citas que ya debían ocurrir",
  citas_sin_marcar: "Citas sin resultado marcado",
  agendas_futuras: "Citas futuras",
  contratado: nombreLargo("vendido"),
  sin_resultado: nombreLargo("llamadas_sin_resultado"),
  atendidos_sin_valor: "Realizadas sin valor vendido",
  atendidos_sin_grain: "Realizadas sin Grain",
  perdidos_con_pagos: "Cierre perdido con pagos registrados",
  grupo_citas: "Deals con cita ocurrida (grupo de las tasas)",
  grupo_shows: "Realizadas del grupo con cita",
  grupo_vendidos: "Vendidas del grupo con cita",
  grupo_sin_show: "No asistieron del grupo con cita",
  grupo_pendientes: "Citas pasadas sin resultado",
  embudo_comercial_creados: "Deals creados",
  embudo_comercial_agendaron: "Deals que agendaron",
  embudo_comercial_shows: "Deals con cita realizada",
  embudo_comercial_compraron: "Deals que compraron",
  etapa_entraron: "Entraron al embudo",
  etapa_paso: "Llegaron al paso",
  etapa_siguen: "Siguen aquí",
  etapa_perdidos: "Se perdieron aquí",
  etapa_otros: "Tomaron otro camino",
  etapa_tiempo: "Salieron de la etapa",
  etapa_abiertos: "Abiertos en la etapa",
  etapa_sin_dueno: "Abiertos sin dueño",
  no_agendaron: "No agendaron",
  escalera: "Ventas por escalón",
  pauta_meta: "Pauta por anuncio",
} as const;

/** El rótulo de la columna de dinero de una lista, según la métrica que la abrió: nunca "Monto". */
export function rotuloDeImporte(metrica: string): string {
  if (metrica === "caja") return "Abono";
  return nombreCorto("vendido");
}

/** Palabras que ninguna cadena visible del Hub puede traer; las caza `tests/hub-vocabulario-guardian.test.ts`. */
export const JERGA_PROHIBIDA_EN_EL_HUB = [
  "Monto", "Contratado", "utm_", "macro", "periodo A", "periodo B",
  // 378: "Meta" sola es ambigua; en pantalla es Objetivo. Estas frases son las que ya se corrigieron.
  "Meta del", "Meta de la", "Meta de leads", "Meta de cupos", "Cumplimiento a la fecha", "Necesarios para llegar",
] as const;
