import { limpiar, normalizarEmail, normalizarTexto, parsearFecha } from "@/lib/sheets/mapeo";
import { fechaDeInstanteEnBogota } from "@/lib/format";

/**
 * Como se lee una celda de las pestañas de gestion. Reusa lo de `lib/sheets/mapeo.ts`
 * (correo, texto, fechas de Bogota con su piso de plausibilidad) y agrega lo que solo la
 * gestion tiene: montos con dos formatos, Si/No escritos a mano y columnas repetidas.
 */

export { limpiar, normalizarEmail, normalizarTexto };

/**
 * Los indices de TODAS las columnas cuyo encabezado es exactamente `texto` (sin acentos ni
 * mayusculas). Exacto a proposito: en estas pestañas `Precio` y `Precio final`, o `Fecha` y
 * `Fecha de contacto`, conviven, y un `includes` agarraria la equivocada sin avisar.
 */
export function columnasExactas(encabezados: readonly string[], texto: string): number[] {
  const buscado = normalizarTexto(texto);
  const indices: number[] = [];
  encabezados.forEach((h, i) => {
    if (normalizarTexto(h) === buscado) indices.push(i);
  });
  return indices;
}

/** La primera columna que casa exacto con alguno de los textos, en el orden dado; -1 si ninguna. */
export function columna(encabezados: readonly string[], ...textos: string[]): number {
  for (const t of textos) {
    const [i] = columnasExactas(encabezados, t);
    if (i !== undefined) return i;
  }
  return -1;
}

/** La celda en la columna `i`, o `undefined` si la columna no existe. */
export function celda(fila: readonly unknown[], i: number): unknown {
  return i < 0 ? undefined : fila[i];
}

/**
 * El correo de una fila. 🩸 En una de las hojas hay filas con el telefono en `Correo` y el correo en
 * `WhatsApp` (87 en `Registro de llamadas`, 26 de 31 en `Septiembre Estudiantes Cohort`,
 * medido el 29-sep): es la MISMA fila con las dos columnas cruzadas, no un emparejamiento
 * por cercania (ADR 0027). `WhatsApp` se mira solo cuando `Correo` no trae un correo, y
 * solo si lo que trae es un correo.
 */
export function correoDeLaFila(fila: readonly unknown[], colCorreo: number, colWhatsapp: number): string | null {
  return normalizarEmail(celda(fila, colCorreo)) ?? normalizarEmail(celda(fila, colWhatsapp));
}

/** Si / No escritos a mano (`Sí`, `si`, `No`, `no`). Otro texto es `"otro"`: no se adivina. */
export function siNo(v: unknown): "si" | "no" | "vacio" | "otro" {
  const t = normalizarTexto(v);
  if (t === "") return "vacio";
  if (t === "si") return "si";
  if (t === "no") return "no";
  return "otro";
}

/**
 * Un monto en USD con los formatos que traen las hojas (`$1,500`, `1300`, `697`, `1.500`),
 * como texto con dos decimales. Lo que no es un numero (`Ya pago`, `#N/A`) es `null`: el
 * llamador lo vuelve rareza, nunca un cero.
 */
export function monto(v: unknown): string | null {
  const s = String(v ?? "")
    .replace(/usd/i, "")
    .replace(/\$/g, "")
    .replace(/\s/g, "");
  if (s === "") return null;
  let n: number;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = Number(s.replace(/,/g, ""));
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^\d+([.,]\d+)?$/.test(s)) n = Number(s.replace(",", "."));
  else return null;
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

/** Un instante de la hoja (Bogota, con el piso de plausibilidad de `parsearFecha`), como ISO. */
export function instante(v: unknown): string | null {
  return parsearFecha(v)?.toISOString() ?? null;
}

/** El dia de Bogota de un instante ISO. */
export function diaDe(iso: string): string {
  return fechaDeInstanteEnBogota(iso);
}

/** Dias de calendario entre dos dias `YYYY-MM-DD` (b - a). Aritmetica de calendario, sin zona. */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** El numero de fila de la hoja (1 = encabezados) de la fila `i` de los datos. */
export function filaDeLaHoja(i: number): number {
  return i + 2;
}

/** Una fila sin ninguna celda con contenido no es una fila. */
export function filaVacia(fila: readonly unknown[]): boolean {
  return !fila.some((c) => String(c ?? "").trim() !== "");
}
