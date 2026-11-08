import { z } from "zod";
import { estaRegistrada, fichaDe, type MonedaDeMetrica, type UnidadDeMetrica } from "@/lib/metricas/registro";
import { definicion, nombreLargo, type ClaveDeMetrica } from "@/lib/vocabulario-metricas";

/** Deuda explícita para el ticket 403; este módulo no completa el registro tipado. */
export const SIN_FICHA_EN_REGISTRO: readonly ClaveDeMetrica[] = ["cita_a_venta"];

type DatosDeCampo = {
  unidad: UnidadDeMetrica;
  monedas: readonly MonedaDeMetrica[];
};

function datosDe(clave: ClaveDeMetrica, sinFicha: DatosDeCampo): DatosDeCampo {
  if (estaRegistrada(clave)) {
    const ficha = fichaDe(clave);
    return { unidad: ficha.unidad, monedas: ficha.monedas };
  }
  return sinFicha;
}

export function descripcionDeMetrica(clave: ClaveDeMetrica): string {
  return `${nombreLargo(clave)}: ${definicion(clave)}`;
}

export function campoDeMetrica(clave: ClaveDeMetrica, sinFicha: DatosDeCampo) {
  const { unidad, monedas } = datosDe(clave, sinFicha);
  const moneda = monedas.length === 0
    ? {}
    : { moneda: z.enum(monedas.map((valor) => valor.toUpperCase()) as [string, ...string[]]).describe("Moneda de la cifra.") };
  return z.object({
    valor: z.number().nullable().describe("Valor de la cifra; null significa que no se puede calcular."),
    unidad: z.literal(unidad).describe("Unidad en que se expresa la cifra."),
    ...moneda,
  }).strict().describe(descripcionDeMetrica(clave));
}

export function campoPorMoneda(clave: ClaveDeMetrica, sinFicha: DatosDeCampo) {
  const { monedas } = datosDe(clave, sinFicha);
  const moneda = monedas.length > 0
    ? z.enum(monedas.map((valor) => valor.toUpperCase()) as [string, ...string[]])
    : z.string().min(3).max(3);
  return z.object({
    moneda: moneda.describe("Moneda del total, sin conversiones."),
    total: z.number().describe(descripcionDeMetrica(clave)),
  }).strict().describe(descripcionDeMetrica(clave));
}

export function campoDeTasa(clave: ClaveDeMetrica) {
  return z.object({
    valor: z.number().nullable().describe("Proporción entre 0 y 1; null significa que no se puede calcular."),
    cobertura: z.number().nullable().describe("Proporción entre 0 y 1 de los datos necesarios que sí están cubiertos."),
    parcial: z.boolean().describe("Indica que la tasa se calculó con cobertura incompleta."),
  }).strict().describe(descripcionDeMetrica(clave));
}
