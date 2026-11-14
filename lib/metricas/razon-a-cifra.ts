/**
 * Una razón con cobertura (`RazonConCobertura`, N3) dicha como entrada de la Cifra (ticket 419, E-2).
 *
 * Es la ÚNICA traducción: lo que antes decidía `components/cifra-de-razon.tsx` en cada pantalla se decide aquí, una
 * vez, y los constructores de cada pestaña la importan. El estado sale de `estadoDeCobertura` y el umbral sigue
 * siendo el de `lib/cobertura.ts`; aquí no se recalcula nada.
 *
 * Módulo PURO.
 */
import { estadoDeCobertura, UMBRAL_COBERTURA_POR_DEFECTO, type RazonConCobertura } from "@/lib/cobertura";
import { num } from "@/lib/format";
import type { EntradaDeCifra } from "@/lib/metricas/cifra";

export const MOTIVO_SIN_DATOS_DE_LA_RAZON = "No hay datos del periodo para calcularla";

export interface OpcionesDeRazon {
  umbral?: number;
  /**
   * Qué es la base, para decirla en palabras cuando la consulta no trae motivo: "citas ya tienen resultado" da
   * "12 de 30 citas ya tienen resultado".
   */
  base?: string;
}

function frase(texto: string): string {
  const limpio = texto.trim().replace(/\.+$/, "");
  return `${limpio.charAt(0).toUpperCase()}${limpio.slice(1)}.`;
}

export function entradaDesdeRazon(
  razon: RazonConCobertura,
  opciones: OpcionesDeRazon = {},
): Pick<EntradaDeCifra, "valor" | "motivo" | "parcial"> {
  const umbral = opciones.umbral ?? UMBRAL_COBERTURA_POR_DEFECTO;
  const estado = estadoDeCobertura(razon, umbral);
  if (estado === "no_calculable") return { valor: null, motivo: razon.motivo ?? MOTIVO_SIN_DATOS_DE_LA_RAZON };
  if (estado === "completa") return { valor: razon.valor };

  const frases: string[] = [];
  const total = razon.base + razon.faltan;
  const baseNoCubre = razon.faltan > 0 && razon.base / total < umbral;
  // El motivo de la consulta ya dice qué falta, en palabras; la base en números solo cuando no lo trae.
  if (razon.motivo) frases.push(frase(razon.motivo));
  else if (baseNoCubre) frases.push(frase(`${num(razon.base)} de ${num(total)} ${opciones.base ?? "ya tienen el dato"}`));
  const pendientes = razon.agendasPendientes ?? 0;
  if (pendientes > 0) {
    frases.push(pendientes === 1
      ? "Hay 1 cita por venir de estas personas: cuando ocurra, la tasa puede cambiar."
      : `Hay ${num(pendientes)} citas por venir de estas personas: cuando ocurran, la tasa puede cambiar.`);
  }
  return { valor: razon.valor, parcial: frases.join(" ") };
}
