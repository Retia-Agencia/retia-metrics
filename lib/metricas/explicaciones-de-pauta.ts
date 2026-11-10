/**
 * El texto que abre cada cifra de Pauta (ticket 419, `docs/diseno-cifra-y-pauta.md` §2.1, DM-9).
 *
 * PUENTE, no casa: el texto de una explicación vive en la ficha del concepto (`FichaDeMetrica.que`, `formula`,
 * `variables`, `aliasExcel` en `./registro.ts`). Los conceptos de Pauta todavía no tienen clave en
 * `ClaveDeMetrica` ni ficha en el registro; cuando el carril D los registre, cada entrada de aquí pasa a su ficha
 * en un commit propio y se borra. Los rótulos son los vigentes de la tabla semanal: los que dependen de D-C, y las
 * fórmulas de D-A, D-B y D-E, no se fijan aquí (los decide el 403).
 *
 * Módulo PURO: lo puede leer un componente cliente. Ningún texto lleva rutas, funciones, tickets ni ids: lo vigila
 * `tests/explicacion-sin-jerga.test.ts`.
 */
import type { FormulaDeMetrica, VariableDeMetrica } from "@/lib/metricas/registro";

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
const ABONADO_O_COMPLETO = "El cliente ya pagó al menos un abono. Un deal en cualquier otra etapa no es venta.";

export const EXPLICACIONES_DE_PAUTA = {
  inversion: {
    rotulo: "Inversión", universo: "pauta", unidad: "cop",
    que: "Lo que se gastó en anuncios de Meta, sumando todas las cuentas del programa.",
    formula: { forma: "suma", terminos: ["gasto de cada día en Meta"] },
    variables: [{ nombre: "Gasto de cada día", explicacion: "Lo que Meta reporta como gastado ese día, en pesos. Entran todas las campañas: agenda, lanzamiento y otras." }],
  },
  presupuesto: {
    rotulo: "Presupuesto usado", universo: "pauta", unidad: "cop",
    que: "Cuánto de la inversión planeada para la cohorte ya se gastó.",
    formula: { forma: "suma", terminos: ["gasto de cada día desde que abrió la venta de la cohorte"] },
    variables: [{ nombre: "Inversión planeada", explicacion: `El presupuesto de la cohorte. Lo cargan Pauta o Gerencia en ${OBJETIVOS}.` }],
  },
  agendas: {
    rotulo: "Agendadas", universo: "pauta", unidad: "conteo",
    que: "Cuántas citas se reservaron, de personas que llegaron por anuncios.",
    formula: { forma: "conteo", terminos: ["citas reservadas en el periodo por personas de pauta"] },
    variables: [
      { nombre: "Cita reservada", explicacion: "La llamada que el lead apartó en el calendario. Cuenta el día en que la reservó, no el día de la llamada." },
      { nombre: "Persona de pauta", explicacion: "Llegó por el enlace de un anuncio pago." },
    ],
  },
  agendas_total: {
    rotulo: "Agendadas", universo: "todas", unidad: "conteo",
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
    rotulo: "Costo por agenda", universo: "pauta", unidad: "cop", admiteObjetivo: true, unidadesDePartes: ["cop", "conteo"],
    que: "Cuánto costó, en promedio, cada cita que trajo la pauta.",
    formula: { forma: "razon", terminos: ["Gasto en campañas de agenda", "Agendadas de pauta"] },
    variables: [
      { nombre: "Gasto en campañas de agenda", explicacion: "Solo las campañas cuyo objetivo es agendar. No entran lanzamientos ni tráfico a Instagram, que se muestran aparte como «otras campañas»." },
      { nombre: "Agendadas de pauta", explicacion: "Citas reservadas en el periodo por personas que llegaron por anuncios, contadas en el CRM." },
    ],
  },
  costo_agenda_meta: {
    rotulo: "Costo por agenda (según Meta)", universo: "pauta", unidad: "cop", unidadesDePartes: ["cop", "conteo"],
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
    rotulo: "Ventas", universo: "pauta", unidad: "conteo",
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
    rotulo: "Facturación", universo: "pauta", unidad: "usd",
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
    rotulo: "ROAS", universo: "pauta", unidad: "veces", admiteObjetivo: true, unidadesDePartes: ["usd", "usd"],
    que: "Cuántos dólares vendidos trajo cada dólar invertido.",
    formula: { forma: "razon", terminos: ["Facturación de pauta", "Inversión en dólares"] },
    variables: [
      { nombre: "Facturación de pauta", explicacion: "El valor vendido de las ventas de pauta, en USD." },
      { nombre: "Inversión en dólares", explicacion: INVERSION_EN_DOLARES },
    ],
  },
  profit: {
    rotulo: "Profit", universo: "pauta", unidad: "usd", unidadesDePartes: ["usd", "usd"],
    que: "Lo vendido en pauta menos lo invertido, los dos en dólares.",
    formula: { forma: "resta", terminos: ["Facturación de pauta", "Inversión en dólares"] },
    variables: [{ nombre: "Inversión en dólares", explicacion: INVERSION_EN_DOLARES }],
  },
  show: {
    rotulo: "% de show", universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    aliasExcel: "% de presentación a zoom",
    que: "De las citas que ya debían ocurrir, qué parte ocurrió.",
    formula: { forma: "razon", terminos: ["Citas realizadas", "Citas del grupo"] },
    variables: [
      { nombre: "Citas realizadas", explicacion: "El closer marcó que la llamada ocurrió." },
      { nombre: "Citas del grupo", explicacion: "Las citas de pauta del periodo cuya hora ya pasó." },
    ],
  },
  cierre_ventas: {
    rotulo: "Cierre de ventas", universo: "pauta", unidad: "porcentaje", unidadesDePartes: ["conteo", "conteo"],
    aliasExcel: "% de cierre zoom a cliente",
    que: "De las llamadas que ocurrieron, qué parte terminó en venta.",
    formula: { forma: "razon", terminos: ["Ventas", "Citas realizadas"] },
    variables: [
      { nombre: "Ventas", explicacion: "De esas mismas citas, las que terminaron en Abonado o Completo." },
      { nombre: "Citas realizadas", explicacion: "El closer marcó que la llamada ocurrió." },
    ],
  },
  agenda_venta: {
    rotulo: "Agenda → venta", universo: "pauta", unidad: "porcentaje", admiteObjetivo: true, unidadesDePartes: ["conteo", "conteo"],
    aliasExcel: "% de cierre agenda a cliente",
    que: "De las citas reservadas, qué parte terminó en venta.",
    formula: { forma: "razon", terminos: ["Ventas", "Agendadas"] },
    variables: [
      { nombre: "Ventas", explicacion: "De esas mismas citas, las que terminaron en Abonado o Completo." },
      { nombre: "Agendadas", explicacion: "Citas reservadas por personas de pauta." },
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

export type ClaveDePauta = keyof typeof EXPLICACIONES_DE_PAUTA;

export function explicacionDePauta(clave: ClaveDePauta): ExplicacionDeConcepto {
  return EXPLICACIONES_DE_PAUTA[clave];
}
