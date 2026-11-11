/**
 * El texto que abre cada cifra de Pauta (ticket 419, `docs/diseno-cifra-y-pauta.md` §2.1, DM-9).
 *
 * PUENTE, no casa: el texto de una explicación vive en la ficha del concepto (`FichaDeMetrica.que`, `formula`,
 * `variables`, `aliasExcel` en `./registro.ts`). El 403 F2 ya registró parte de estos conceptos (`ClaveDePauta` de
 * `lib/vocabulario-metricas.ts`) sin el texto; cada entrada pasa a su ficha en un commit propio cuando el 403 avise,
 * y este archivo se borra. Los rótulos salen del vocabulario (D-C). Lo que cada texto dice de la fórmula sigue su fila
 * de `docs/metricas.md`: show, cierre y cita a venta sobre el grupo de citas de Paid (D-A); ROAS, Profit y las ventas
 * de la tabla por la semana del registro, no de la venta (D-B); la inversión sin gasto cargado en «—» (D-E).
 *
 * Módulo PURO: lo puede leer un componente cliente. Ningún texto lleva rutas, funciones, tickets ni ids: lo vigila
 * `tests/explicacion-sin-jerga.test.ts`.
 */
import type { FormulaDeMetrica, VariableDeMetrica } from "@/lib/metricas/registro";
import { nombreCorto, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

export type UniversoDeCifra = "pauta" | "todas";

/** Cómo se escribe un número de la cifra. "decimal" es un promedio con un decimal; "veces" el ROAS ("6,1×"). */
export type UnidadDeCifra = "conteo" | "decimal" | "cop" | "usd" | "porcentaje" | "veces";

/** Todo lo que la explicación dice del CONCEPTO, sin los números de una cifra concreta. */
export interface ExplicacionDeConcepto {
  rotulo: string;
  universo: UniversoDeCifra;
  unidad: UnidadDeCifra;
  que: string;
  formula: FormulaDeMetrica;
  variables: readonly VariableDeMetrica[];
  aliasExcel?: string;
  /** El concepto admite objetivo en Programa › Objetivos: sin uno cargado, la explicación dice "Sin color". */
  admiteObjetivo?: boolean;
  /** Unidades de [numerador, denominador] (o [A, B]) para escribir "Con los números de esta cifra". */
  unidadesDePartes?: readonly [UnidadDeCifra, UnidadDeCifra];
}

const OBJETIVOS = "Programa › Objetivos";
const VALOR_VENDIDO = "El precio pactado, en USD. Lo ya pagado es «Recaudado» y lo que falta es «Por cobrar».";
const INVERSION_EN_DOLARES = "El gasto de cada día en pesos dividido por la tasa de cambio de ese día.";
const ID_DEL_ANUNCIO = "Lo agrega Meta al enlace si el anuncio usa la plantilla de enlaces de Retia.";
const SEMANA_DEL_REGISTRO = "Cuenta en la semana en que la persona se registró, aunque haya comprado semanas después; no en la semana de la venta.";
const GRUPO_DE_CITAS = "Los deals de pauta con al menos una cita del periodo cuya hora ya pasó: asistió, no asistió o canceló. Cada deal cuenta una vez. No entran las reagendadas (cuenta su cita nueva), las cortesías ni los anulados.";
const ASISTIERON = "Deals del grupo con al menos una cita a la que la persona asistió, según lo marcó el closer.";
const VENDIDOS_HOY = "De los deals que asistieron, los que hoy están en Abonado o Completo, aunque hayan comprado después del periodo.";
const SIN_MARCAR = "Citas cuya hora ya pasó y el closer no ha dicho qué pasó. Quedan fuera del grupo hasta que se marquen; si hay, la cifra sale como parcial y se puede abrir la lista.";
const ABONADO_O_COMPLETO = "El cliente ya pagó al menos un abono. Un deal en cualquier otra etapa no es venta.";

export const EXPLICACIONES_DE_PAUTA = {
  inversion: {
    rotulo: VOCABULARIO_PAUTA_SEMANAL.inversion, universo: "pauta", unidad: "cop",
    que: "Lo que se gastó en anuncios de Meta, sumando todas las cuentas del programa.",
    formula: { forma: "suma", terminos: ["gasto de cada día en Meta"] },
    variables: [
      { nombre: "Gasto de cada día", explicacion: "Lo que Meta reporta como gastado ese día, en pesos. Entran todas las campañas: agenda, lanzamiento y otras." },
      { nombre: "Semana sin gasto cargado", explicacion: "Si el gasto de Meta todavía no se había cargado esa semana, sale «—» y la fecha desde la que hay gasto. Cero solo cuando el gasto cargado sumó cero." },
    ],
  },
  presupuesto: {
    rotulo: "Presupuesto usado", universo: "pauta", unidad: "cop",
    que: "Cuánto de la inversión planeada para la cohorte ya se gastó.",
    formula: { forma: "suma", terminos: ["gasto de cada día desde que abrió la venta de la cohorte"] },
    variables: [{ nombre: "Inversión planeada", explicacion: `El presupuesto de la cohorte. Lo cargan Pauta o Gerencia en ${OBJETIVOS}.` }],
  },
  agendas: {
    rotulo: nombreCorto("agendadas"), universo: "pauta", unidad: "conteo",
    que: "Cuántas citas se reservaron, de personas que llegaron por anuncios.",
    formula: { forma: "conteo", terminos: ["citas reservadas en el periodo por personas de pauta"] },
    variables: [
      { nombre: "Cita reservada", explicacion: "La llamada que el lead apartó en el calendario. Cuenta el día en que la reservó, no el día de la llamada." },
      { nombre: "Persona de pauta", explicacion: "Llegó por el enlace de un anuncio pago." },
    ],
  },
  agendas_total: {
    rotulo: nombreCorto("agendadas"), universo: "todas", unidad: "conteo",
    que: "Cuántas citas se reservaron en la cohorte, vengan de pauta, orgánico, referidos o sin origen.",
    formula: { forma: "conteo", terminos: ["citas reservadas desde que abrió la venta de la cohorte"] },
    variables: [{ nombre: "Cita reservada", explicacion: "La llamada que el lead apartó en el calendario. Cuenta el día en que la reservó, no el día de la llamada." }],
  },
  agendas_meta: {
    rotulo: "Agendas según Meta", universo: "pauta", unidad: "conteo",
    que: "Las agendas que reporta el pixel de Meta. Sirven para revisar la medición, no como dato de negocio.",
    formula: { forma: "conteo", terminos: ["agendas que reporta el pixel de Meta"] },
    variables: [{ nombre: "Pixel de Meta", explicacion: "El código de Meta en la página de agenda. No siempre ve lo mismo que el CRM; la diferencia avisa que algo se está midiendo mal." }],
  },
  costo_agenda_crm: {
    rotulo: VOCABULARIO_PAUTA_SEMANAL.costo_agenda_crm, universo: "pauta", unidad: "cop", admiteObjetivo: true, unidadesDePartes: ["cop", "conteo"],
    que: "Cuánto costó, en promedio, cada cita que trajo la pauta.",
    formula: { forma: "razon", terminos: ["Gasto en campañas de agenda", "Agendadas de pauta"] },
    variables: [
      { nombre: "Gasto en campañas de agenda", explicacion: "Solo las campañas cuyo objetivo es agendar. No entran lanzamientos ni tráfico a Instagram, que se muestran aparte como «otras campañas»." },
      { nombre: "Agendadas de pauta", explicacion: "Citas reservadas en el periodo por personas que llegaron por anuncios, contadas en el CRM." },
    ],
  },
  costo_agenda_meta: {
    rotulo: VOCABULARIO_PAUTA_SEMANAL.costo_agenda_meta, universo: "pauta", unidad: "cop", unidadesDePartes: ["cop", "conteo"],
    que: "El mismo costo por agenda, pero dividiendo por las agendas que ve Meta en vez de las del CRM.",
    formula: { forma: "razon", terminos: ["Gasto en campañas de agenda", "Agendas según Meta"] },
    variables: [{ nombre: "Agendas según Meta", explicacion: "Las que reporta el pixel. Si difiere mucho del costo por agenda del CRM, la medición tiene un problema." }],
  },
  cac: {
    rotulo: "Costo por venta", universo: "pauta", unidad: "cop", admiteObjetivo: true, unidadesDePartes: ["cop", "conteo"],
    que: "Cuánto se invirtió en pauta por cada venta de pauta. También se le dice CAC.",
    formula: { forma: "razon", terminos: ["Inversión", "Ventas de pauta"] },
    variables: [
      { nombre: "Inversión", explicacion: "Todo lo gastado en Meta en el periodo." },
      { nombre: "Ventas de pauta", explicacion: "Deals de personas de pauta que pasaron a Abonado o Completo en el periodo." },
    ],
  },
  ventas: {
    rotulo: nombreCorto("ventas"), universo: "pauta", unidad: "conteo",
    que: "Cuántos deals de personas de pauta pasaron a Abonado o Completo.",
    formula: { forma: "conteo", terminos: ["deals en Abonado o Completo, por la fecha de la venta"] },
    variables: [{ nombre: "Abonado o Completo", explicacion: ABONADO_O_COMPLETO }],
  },
  ventas_total: {
    rotulo: "Ventas totales", universo: "todas", unidad: "conteo",
    que: "Todas las ventas de la cohorte, vengan de pauta, orgánico, referidos o sin origen.",
    formula: { forma: "conteo", terminos: ["deals de la cohorte en Abonado o Completo"] },
    variables: [{ nombre: "Abonado o Completo", explicacion: ABONADO_O_COMPLETO }],
  },
  facturacion: {
    rotulo: nombreCorto("vendido"), universo: "pauta", unidad: "usd",
    que: "Cuánto se vendió, en dólares: el valor pactado con el cliente, no lo que ya entró a caja.",
    formula: { forma: "suma", terminos: ["valor vendido de cada venta de pauta"] },
    variables: [{ nombre: "Valor vendido", explicacion: VALOR_VENDIDO }],
  },
  vendido_pauta: {
    rotulo: "Vendido de pauta", universo: "pauta", unidad: "usd",
    que: "El valor pactado de las ventas de pauta de la cohorte, en dólares.",
    formula: { forma: "suma", terminos: ["valor vendido de cada venta de pauta de la cohorte"] },
    variables: [{ nombre: "Valor vendido", explicacion: VALOR_VENDIDO }],
  },
  vendido_total: {
    rotulo: "Vendido total", universo: "todas", unidad: "usd",
    que: "El valor pactado de todas las ventas de la cohorte, en dólares.",
    formula: { forma: "suma", terminos: ["valor vendido de cada venta de la cohorte"] },
    variables: [{ nombre: "Valor vendido", explicacion: VALOR_VENDIDO }],
  },
  roas: {
    rotulo: VOCABULARIO_PAUTA_SEMANAL.roas, universo: "pauta", unidad: "veces", admiteObjetivo: true, unidadesDePartes: ["usd", "usd"],
    que: "Cuántos dólares vendidos trajo cada dólar invertido.",
    formula: { forma: "razon", terminos: [`${nombreCorto("vendido")} de pauta`, "Inversión en dólares"] },
    variables: [
      { nombre: `${nombreCorto("vendido")} de pauta`, explicacion: `El valor vendido de las ventas de pauta, en USD. ${SEMANA_DEL_REGISTRO}` },
      { nombre: "Inversión en dólares", explicacion: INVERSION_EN_DOLARES },
      { nombre: "Parcial", explicacion: "Si alguna venta viene de un día sin gasto cargado, el ROAS sale como parcial o «—»: dividir esa venta por un gasto que falta lo inflaría." },
    ],
  },
  profit: {
    rotulo: "Profit", universo: "pauta", unidad: "usd", unidadesDePartes: ["usd", "usd"],
    que: "Lo vendido en pauta menos lo invertido, los dos en dólares.",
    formula: { forma: "resta", terminos: [`${nombreCorto("vendido")} de pauta`, "Inversión en dólares"] },
    variables: [
      { nombre: `${nombreCorto("vendido")} de pauta`, explicacion: SEMANA_DEL_REGISTRO },
      { nombre: "Inversión en dólares", explicacion: INVERSION_EN_DOLARES },
    ],
  },
  show: {
    rotulo: nombreCorto("asistencia"), universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    aliasExcel: "% de show / % presentación a zoom",
    que: "De los deals de pauta con cita ya pasada, qué parte asistió.",
    formula: { forma: "razon", terminos: ["Deals que asistieron", "Deals del grupo"] },
    variables: [
      { nombre: "Deals que asistieron", explicacion: ASISTIERON },
      { nombre: "Deals del grupo", explicacion: GRUPO_DE_CITAS },
      { nombre: "Sin marcar", explicacion: SIN_MARCAR },
    ],
  },
  cierre_ventas: {
    rotulo: nombreCorto("cierre_de_ventas"), universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    aliasExcel: "% de cierre zoom a cliente",
    que: "De los deals de pauta que asistieron a su cita, qué parte ya compró.",
    formula: { forma: "razon", terminos: ["Deals que asistieron y compraron", "Deals que asistieron"] },
    variables: [
      { nombre: "Deals que asistieron y compraron", explicacion: VENDIDOS_HOY },
      { nombre: "Deals que asistieron", explicacion: `${ASISTIERON} ${GRUPO_DE_CITAS}` },
      { nombre: "Sin marcar", explicacion: SIN_MARCAR },
    ],
  },
  agenda_venta: {
    rotulo: nombreCorto("cita_a_venta"), universo: "pauta", unidad: "porcentaje", admiteObjetivo: true, unidadesDePartes: ["conteo", "conteo"],
    aliasExcel: "% de cierre agenda a cliente",
    que: "De los deals de pauta con cita ya pasada, qué parte asistió y compró. Es la asistencia por el cierre.",
    formula: { forma: "razon", terminos: ["Deals que asistieron y compraron", "Deals del grupo"] },
    variables: [
      { nombre: "Deals que asistieron y compraron", explicacion: VENDIDOS_HOY },
      { nombre: "Deals del grupo", explicacion: GRUPO_DE_CITAS },
      { nombre: "Sin marcar", explicacion: SIN_MARCAR },
    ],
  },
  cpm: {
    rotulo: "CPM", universo: "pauta", unidad: "cop", unidadesDePartes: ["cop", "conteo"],
    que: "Cuánto cuesta que Meta muestre los anuncios mil veces.",
    formula: { forma: "razon", terminos: ["Inversión", "Impresiones"], por1000: true },
    variables: [{ nombre: "Impresiones", explicacion: "Veces que Meta mostró los anuncios." }],
  },
  ctr: {
    rotulo: "CTR", universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    que: "De las veces que se mostró un anuncio, qué parte terminó en un clic al enlace.",
    formula: { forma: "razon", terminos: ["Clics al enlace", "Impresiones"] },
    variables: [{ nombre: "Clics al enlace", explicacion: "Clics que llevan a la landing; no cuenta likes ni clics al perfil." }],
  },
  llegada_landing: {
    rotulo: "Llegada a la landing", universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    que: "De los clics al enlace, qué parte terminó de cargar la página.",
    formula: { forma: "razon", terminos: ["Vistas de la landing", "Clics al enlace"] },
    variables: [{ nombre: "Vistas de la landing", explicacion: "Meta cuenta una cuando la página terminó de cargar. Un clic sin vista suele ser alguien que se fue antes." }],
  },
  conversion_landing: {
    rotulo: "Conversión de la landing", universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    que: "De quienes vieron la página, qué parte se registró en el formulario.",
    formula: { forma: "razon", terminos: ["Registros de pauta", "Vistas de la landing"] },
    variables: [{ nombre: "Registros de pauta", explicacion: "Formularios enviados que llegaron al CRM desde anuncios." }],
  },
  frecuencia: {
    rotulo: "Frecuencia", universo: "pauta", unidad: "decimal", unidadesDePartes: ["conteo", "conteo"],
    que: "Cuántas veces, en promedio, vio los anuncios cada persona.",
    formula: { forma: "razon", terminos: ["Impresiones", "Personas alcanzadas"] },
    variables: [{ nombre: "Personas alcanzadas", explicacion: "Personas distintas que vieron algún anuncio. Meta solo la da día por día; por eso en una semana sale «—»." }],
  },
  agendas_dia: {
    rotulo: "Agendas por día", universo: "pauta", unidad: "decimal", unidadesDePartes: ["conteo", "conteo"],
    que: "Cuántas citas se reservan, en promedio, por día hábil de la cohorte.",
    formula: { forma: "razon", terminos: ["Agendadas de la cohorte", "Días hábiles transcurridos"] },
    variables: [{ nombre: "Días hábiles", explicacion: "De lunes a viernes; los festivos cuentan como hábiles." }],
  },
  agendas_req: {
    rotulo: "Agendas por día necesarias", universo: "pauta", unidad: "decimal", unidadesDePartes: ["conteo", "conteo"],
    que: "Cuántas citas por día hacen falta, de hoy al cierre, para llegar a la meta.",
    formula: { forma: "razon", terminos: ["Meta − Agendadas", "Días hábiles que faltan"] },
    variables: [
      { nombre: "Meta", explicacion: `La meta de agendas de la cohorte, en ${OBJETIVOS}.` },
      { nombre: "Días hábiles que faltan", explicacion: "De hoy al cierre de la venta de la cohorte, de lunes a viernes." },
    ],
  },
  inversion_req: {
    rotulo: "Inversión por día necesaria", universo: "pauta", unidad: "cop", unidadesDePartes: ["decimal", "cop"],
    que: "Cuánto habría que invertir por día para conseguir las agendas necesarias.",
    formula: { forma: "producto", terminos: ["Agendas por día necesarias", "Costo por agenda"] },
    variables: [{ nombre: "Costo por agenda", explicacion: "Se calcula con dos: el objetivo de la cohorte (la cifra grande) y el promedio real de la cohorte (la línea de abajo)." }],
  },
  roas_proy: {
    rotulo: "ROAS proyectado", universo: "pauta", unidad: "veces", unidadesDePartes: ["usd", "usd"],
    que: "El ROAS que se espera cuando ocurran las citas de pauta que faltan.",
    formula: { forma: "razon", terminos: ["Vendido a hoy + Valor esperado de las citas pendientes", "Inversión en dólares"] },
    variables: [
      { nombre: "Valor esperado de una cita", explicacion: "Probabilidad de que ocurra × probabilidad de que cierre × precio de la cohorte." },
      { nombre: "Probabilidades", explicacion: "Las del closer dueño de la cita en las últimas 3 semanas. Si un closer tiene muy pocas citas, se usa la del programa." },
    ],
  },
  envios_sin_id: {
    rotulo: "Registros de pauta sin anuncio", universo: "pauta", unidad: "conteo",
    que: "Registros que llegaron por un anuncio pago pero sin el dato de cuál anuncio fue. Sin ese dato no se sabe qué anuncio vendió.",
    formula: { forma: "conteo", terminos: ["registros de pauta que llegaron sin el id del anuncio"] },
    variables: [{ nombre: "Id del anuncio", explicacion: ID_DEL_ANUNCIO }],
  },
  registros_sin_utm: {
    rotulo: "Registros sin origen", universo: "todas", unidad: "conteo",
    que: "Registros que llegaron sin decir de dónde vienen. No se pueden recuperar: se corrige el enlace hacia adelante.",
    formula: { forma: "conteo", terminos: ["registros sin fuente ni medio en el enlace"] },
    variables: [{ nombre: "Origen", explicacion: "Lo que dice el enlace por el que llegó la persona: plataforma, tipo de tráfico y campaña." }],
  },
  ventas_sin_anuncio: {
    rotulo: "Ventas sin anuncio identificado", universo: "pauta", unidad: "conteo",
    que: "Ventas de pauta en las que no se sabe qué anuncio trajo a la persona.",
    formula: { forma: "conteo", terminos: ["ventas de pauta cuyo registro llegó sin id del anuncio"] },
    variables: [{ nombre: "Id del anuncio", explicacion: ID_DEL_ANUNCIO }],
  },
  embudo: {
    rotulo: "Paso del formulario", universo: "todas", unidad: "conteo", unidadesDePartes: ["conteo", "conteo"],
    que: "Cuántas personas llegaron a este paso del formulario.",
    formula: { forma: "razon", terminos: ["Personas en este paso", "Personas que abrieron el formulario"] },
    variables: [{ nombre: "Abrieron el formulario", explicacion: "Personas que cargaron la primera pregunta." }],
  },
} as const satisfies Record<string, ExplicacionDeConcepto>;

/** Las claves de este puente. No es `ClaveDePauta` de `lib/vocabulario-metricas.ts`: aquí hay más (agendas, ventas, tasas). */
export type ClaveDeExplicacionDePauta = keyof typeof EXPLICACIONES_DE_PAUTA;

export function explicacionDePauta(clave: ClaveDeExplicacionDePauta): ExplicacionDeConcepto {
  return EXPLICACIONES_DE_PAUTA[clave];
}
