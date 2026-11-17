/** Arma la explicación visible desde la ficha única del concepto y una variante de la vista. Módulo puro. */
import type { ExplicacionDeConcepto, UnidadDeCifra, UniversoDeCifra } from "@/lib/metricas/cifra";
import { unidadDeCifra } from "@/lib/metricas/cifra";
import { fichaDe, type ClaveRegistrada, type MonedaDeMetrica } from "@/lib/metricas/registro";
import {
  ESCALONES,
  GRUPOS_DE_CIERRE,
  NOMBRE_DE_ESCALON,
  NOMBRE_DE_GRUPO_DE_CIERRE,
  type Escalon,
  type GrupoDeCierre,
} from "@/lib/escalones";
import { nombreDeConcepto } from "@/lib/vocabulario-metricas";

export type VarianteDeExplicacion = Partial<Pick<ExplicacionDeConcepto,
  "rotulo" | "que" | "formula" | "variables" | "aliasExcel" | "admiteObjetivo" | "unidadesDePartes"
>> & {
  universo?: UniversoDeCifra;
  moneda?: MonedaDeMetrica;
  unidad?: UnidadDeCifra;
};

const ABONADO_O_COMPLETO = {
  nombre: "Abonado o Completo",
  explicacion: "El cliente ya pagó al menos un abono. Un deal en cualquier otra etapa no es venta.",
};

/** Diferencias propias de una vista de Pauta; nunca crean una segunda ficha del concepto. */
export const VARIANTES_DE_PAUTA = {
  agendas_total: {
    universo: "todas",
    que: "Cuántas citas se reservaron en la cohorte, vengan de pauta, orgánico, referidos o sin origen.",
    formula: { forma: "conteo", terminos: ["citas reservadas desde que abrió la venta de la cohorte"] },
    variables: [{ nombre: "Cita reservada", explicacion: "La llamada que el lead apartó en el calendario. Cuenta el día en que la reservó, no el día de la llamada." }],
  },
  agendas_meta: {
    rotulo: "Agendas de Meta", universo: "pauta", unidad: "conteo",
    que: "Las agendas que reporta el pixel de Meta. Sirven para revisar la medición, no como dato de negocio.",
    formula: { forma: "conteo", terminos: ["agendas que reporta el pixel de Meta"] },
    variables: [{ nombre: "Pixel de Meta", explicacion: "El código de Meta en la página de agenda. La diferencia contra el CRM avisa que algo se está midiendo mal." }],
  },
  ventas_total: {
    rotulo: "Ventas totales", universo: "todas",
    que: "Todas las ventas de la cohorte, vengan de pauta, orgánico, referidos o sin origen.",
    formula: { forma: "conteo", terminos: ["deals de la cohorte en Abonado o Completo"] },
    variables: [ABONADO_O_COMPLETO],
  },
  facturacion: {
    universo: "pauta", moneda: "usd",
    que: "Cuánto se vendió, en dólares: el valor pactado con el cliente, no lo que ya entró a caja.",
    formula: { forma: "suma", terminos: ["valor vendido de cada venta de pauta"] },
    variables: [{ nombre: "Valor vendido", explicacion: "El precio pactado, en USD. Lo ya pagado es Recaudado y lo que falta es Por cobrar." }],
  },
  vendido_pauta: {
    rotulo: "Vendido de pauta", universo: "pauta", moneda: "usd",
    que: "El valor pactado de las ventas de pauta de la cohorte, en dólares.",
    formula: { forma: "suma", terminos: ["valor vendido de cada venta de pauta de la cohorte"] },
    variables: [{ nombre: "Valor vendido", explicacion: "El precio pactado, en USD. Lo ya pagado es Recaudado y lo que falta es Por cobrar." }],
  },
  vendido_total: {
    rotulo: "Vendido total", universo: "todas", moneda: "usd",
    que: "El valor pactado de todas las ventas de la cohorte, en dólares.",
    formula: { forma: "suma", terminos: ["valor vendido de cada venta de la cohorte"] },
    variables: [{ nombre: "Valor vendido", explicacion: "El precio pactado, en USD. Lo ya pagado es Recaudado y lo que falta es Por cobrar." }],
  },
  inversion_origen: {
    universo: "pauta", moneda: "cop",
    que: "Lo que Meta reporta como gastado en esta campaña o este anuncio durante el periodo, en pesos.",
    formula: { forma: "suma", terminos: ["gasto de cada día del periodo en los anuncios de esta fila"] },
    variables: [{ nombre: "Gasto", explicacion: "Lo que reporta Meta por anuncio; un gasto en dólares se pasa a pesos con la tasa de cambio de ese día." }],
  },
  agendas_origen: {
    universo: "pauta",
    que: "Las citas de las personas que se registraron en el periodo por esta campaña o este anuncio, aunque las reservaran después.",
    formula: { forma: "conteo", terminos: ["citas de las personas registradas en el periodo por esta fila"] },
    variables: [{ nombre: "Registradas en el periodo", explicacion: "Cuenta por el día en que la persona llenó el formulario, no por el día de la cita." }],
  },
  costo_agenda_origen: {
    universo: "pauta", moneda: "cop",
    que: "Cuánto costó, en promedio, cada cita que trajo esta campaña o este anuncio.",
    formula: { forma: "razon", terminos: ["Inversión de la fila", "Agendadas de la fila"] },
    variables: [{ nombre: "Agendadas de la fila", explicacion: "Las citas de las personas que se registraron en el periodo por esta fila, aunque las reservaran después." }],
    unidadesDePartes: ["cop", "conteo"],
  },
  ventas_origen: {
    universo: "pauta",
    que: "Las ventas de las personas que se registraron en el periodo por esta campaña o este anuncio, aunque compraran después.",
    formula: { forma: "conteo", terminos: ["deals en Abonado o Completo de las personas registradas en el periodo por esta fila"] },
    variables: [ABONADO_O_COMPLETO],
  },
} as const satisfies Record<string, VarianteDeExplicacion>;

/**
 * Las fichas se escribieron para Pauta. Donde el texto dice "de pauta" y la vista cuenta todas las áreas
 * (Hoy, Comercial, Dinero y el norte), la variante `universo: "todas"` toma estas frases neutras. Nunca crean una segunda ficha.
 */
const FRASE_PARA_TODAS_LAS_AREAS: Partial<Record<ClaveRegistrada, VarianteDeExplicacion>> = {
  agendadas: {
    que: "Cuántas citas se reservaron, vengan de pauta, orgánico, referidos o sin origen.",
    formula: { forma: "conteo", terminos: ["citas reservadas en el periodo"] },
    variables: [{ nombre: "Cita reservada", explicacion: "La llamada que el lead apartó en el calendario. Cuenta el día en que la reservó, no el día de la llamada." }],
  },
  cierre_de_ventas: { que: "De los deals que asistieron a su cita, qué parte ya compró." },
  ventas: { que: "Cuántos deals pasaron a Abonado o Completo, vengan de pauta, orgánico, referidos o sin origen." },
  vendido: { formula: { forma: "suma", terminos: ["valor vendido de cada venta"] } },
};

export function explicacionDe(
  clave: ClaveRegistrada,
  variante: VarianteDeExplicacion = {},
): ExplicacionDeConcepto {
  const ficha = fichaDe(clave);
  const { universo = "pauta", moneda, unidad, ...texto } = variante;
  return {
    rotulo: nombreDeConcepto(clave),
    universo,
    unidad: unidad ?? unidadDeCifra(ficha, moneda),
    que: ficha.que,
    formula: ficha.formula,
    variables: ficha.variables,
    ...(ficha.aliasExcel ? { aliasExcel: ficha.aliasExcel } : {}),
    ...(ficha.admiteObjetivo ? { admiteObjetivo: true } : {}),
    ...(ficha.unidadesDePartes ? { unidadesDePartes: ficha.unidadesDePartes } : {}),
    ...(universo === "todas" ? FRASE_PARA_TODAS_LAS_AREAS[clave] : undefined),
    ...texto,
  };
}

type BaseDeRecorrido = { base: ClaveRegistrada; variante?: VarianteDeExplicacion };

function variantesDeEscalera<K extends Escalon | GrupoDeCierre>(
  claves: readonly K[],
  nombres: Readonly<Record<K, string>>,
): Record<K, BaseDeRecorrido> {
  const variables = fichaDe("ventas_por_escalon").variables;
  return claves.reduce<Record<K, BaseDeRecorrido>>((recorridos, clave) => {
    const variable = variables.find(({ nombre }) => nombre === nombres[clave]);
    if (!variable) throw new Error(`Falta la variable aprobada de ${clave}`);
    recorridos[clave] = { base: "ventas_por_escalon", variante: { rotulo: variable.nombre, que: variable.explicacion, variables: [variable] } };
    return recorridos;
  }, {} as Record<K, BaseDeRecorrido>);
}

const CLAVES_DE_GRUPOS = Object.keys(GRUPOS_DE_CIERRE) as GrupoDeCierre[];
const RECORRIDOS_DE_ESCALERA = variantesDeEscalera(ESCALONES, NOMBRE_DE_ESCALON);
const RECORRIDOS_DE_GRUPOS = variantesDeEscalera(CLAVES_DE_GRUPOS, NOMBRE_DE_GRUPO_DE_CIERRE);

export const RECORRIDOS_DE_COMERCIAL: Record<string, BaseDeRecorrido> = {
  ...RECORRIDOS_DE_ESCALERA,
  ...RECORRIDOS_DE_GRUPOS,
  porcentaje_de_escalera: { base: "ventas_por_escalon", variante: {
    rotulo: "% del escalón", unidad: "porcentaje",
    que: "Qué parte de los deals del conjunto quedó en este escalón.",
    formula: { forma: "razon", terminos: ["deals del escalón", "deals del conjunto"] },
  } },
  dias_medianos_de_escalera: { base: "dias_cita_a_pago" },
  cita_sin_resultado_de_escalera: { base: "escalera_sin_resultado", variante: { rotulo: "Cita pasada sin resultado" } },
  embudo_comercial_creados: { base: "embudo_comercial", variante: { rotulo: "Creados" } },
  embudo_comercial_agendaron: { base: "embudo_comercial", variante: { rotulo: "Agendaron" } },
  embudo_comercial_tuvieron_show: { base: "embudo_comercial", variante: { rotulo: "Tuvieron show" } },
  embudo_comercial_compraron: { base: "embudo_comercial", variante: { rotulo: "Compraron" } },
  conversion_del_paso: { base: "embudo_comercial", variante: {
    rotulo: "Conversión del paso", unidad: "porcentaje",
    que: "Qué parte del paso anterior llegó a este.",
    formula: { forma: "razon", terminos: ["deals del paso", "deals del paso anterior"] },
  } },
  perdidos_del_paso: { base: "embudo_comercial", variante: {
    rotulo: "Se quedaron en el paso anterior",
    que: "Cuántos deals del paso anterior no llegaron a este.",
    formula: { forma: "resta", terminos: ["deals del paso anterior", "deals de este paso"] },
  } },
  pasaron: { base: "conversion_por_etapa", variante: { rotulo: "Pasaron" } },
  siguen_en_etapa: { base: "conversion_por_etapa", variante: { rotulo: "Siguen aquí" } },
  perdidos_en_etapa: { base: "conversion_por_etapa", variante: { rotulo: "Se perdieron aquí" } },
  dias_medianos_en_etapa: { base: "tiempo_en_etapa" },
  citas_futuras: { base: "citas", variante: {
    rotulo: "Citas futuras",
    que: "Cuántas citas de la semana todavía no ocurren.",
    formula: { forma: "conteo", terminos: ["citas agendadas con hora futura"] },
    variables: [{ nombre: "Cita futura", explicacion: "Todavía no sucede: no es una cita sin resultado ni una inasistencia." }],
  } },
  deals_perdidos: { base: "perdidos_por_motivo", variante: { rotulo: "Deals perdidos" } },
  ticket_perdido: { base: "ticket_perdido", variante: { moneda: "usd" } },
  shows: { base: "shows" },
  no_asistio: { base: "no_asistio" },
  citas_sin_marcar: { base: "citas_pendientes" },
  deals_abiertos: { base: "deals_abiertos" },
  deals_sin_dueno: { base: "deals_sin_dueno" },
};

export function explicacionesDeRecorridos(): Readonly<Record<string, ExplicacionDeConcepto>> {
  return Object.fromEntries(Object.entries(RECORRIDOS_DE_COMERCIAL).map(([clave, { base, variante }]) => [
    clave,
    explicacionDe(base, { universo: "todas", ...variante }),
  ]));
}
