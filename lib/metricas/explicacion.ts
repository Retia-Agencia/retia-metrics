/** Arma la explicación visible desde la ficha única del concepto y una variante de la vista. Módulo puro. */
import type { ExplicacionDeConcepto, UnidadDeCifra, UniversoDeCifra } from "@/lib/metricas/cifra";
import { unidadDeCifra } from "@/lib/metricas/cifra";
import { fichaDe, type ClaveRegistrada, type MonedaDeMetrica } from "@/lib/metricas/registro";
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
    ...texto,
  };
}
