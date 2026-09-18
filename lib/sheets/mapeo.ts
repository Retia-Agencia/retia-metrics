/**
 * Resolucion de columnas: que encabezado de la hoja alimenta que campo.
 *
 * El mapeo se guarda por fuente en `sources.mapeoColumnas` y se resuelve **por
 * coincidencia de texto en el encabezado**, no por posicion. Los tres formularios
 * de personas (uno de los programas aporta dos, el otro uno) tienen el mismo
 * esquema pero redaccion distinta en las preguntas, asi que buscar por fragmento
 * aguanta esas diferencias sin un mapeo por hoja.
 *
 * Si un campo obligatorio no encuentra columna, el sync falla ruidosamente.
 * Nunca se adivina.
 */

import { ErrorDeApp } from "@/lib/errors";

export type MapeoColumnas = Record<string, string | string[]>;

/** Quita acentos y baja a minusculas, para comparar encabezados sin sorpresas. */
export function normalizarTexto(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export class MapeoInvalidoError extends ErrorDeApp {
  constructor(
    readonly campo: string,
    readonly buscado: string[],
    readonly encabezados: string[],
  ) {
    // 422: el mensaje dice que columna falto y que encabezados venian, y eso es
    // exactamente lo que hace falta para arreglar el mapeo sin abrir los logs.
    super(
      `No encontre columna para "${campo}". Busque: ${buscado.join(" | ")}. ` +
        `Encabezados reales: ${encabezados.filter(Boolean).join(" · ")}`,
      422,
    );
  }
}

/**
 * Devuelve el indice de columna de cada campo del mapeo.
 * `obligatorios` son los que, de faltar, detienen el sync.
 */
export function resolverColumnas(
  encabezados: string[],
  mapeo: MapeoColumnas,
  obligatorios: string[] = [],
): Record<string, number> {
  const normalizados = encabezados.map(normalizarTexto);
  const indices: Record<string, number> = {};

  for (const [campo, patron] of Object.entries(mapeo)) {
    const buscados = (Array.isArray(patron) ? patron : [patron]).map(normalizarTexto);

    // Exacto primero, parcial despues. Con solo `includes`, un patron de una sola
    // palabra como "estado" agarra "estado de la llamada" nada mas que por estar
    // mas a la izquierda, y el error es invisible.
    let i = normalizados.findIndex((h) => h !== "" && buscados.includes(h));
    if (i < 0) i = normalizados.findIndex((h) => h !== "" && buscados.some((b) => h.includes(b)));

    if (i >= 0) indices[campo] = i;
    else if (obligatorios.includes(campo)) {
      throw new MapeoInvalidoError(campo, buscados, encabezados);
    }
  }

  return indices;
}

/** El mapeo por defecto de un formulario de aplicacion. Sirve para los dos programas. */
export const MAPEO_FORMULARIO: MapeoColumnas = {
  nombre: "nombre completo",
  emailNormalizado: "correo electronico",
  telefono: "whatsapp",
  ingresoDeclarado: "ganas mensualmente",
  porQueAplico: "que te motivo",
  urgencia: "que tan urgente",
  cargo: "situacion profesional",
  capacidadInvertir: "capacidad de invertir",
  agenda: "agenda aqui tu entrevista",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  fechaAplicacion: "submitted at",
  estado: "estado",
};

export const OBLIGATORIOS_FORMULARIO = ["emailNormalizado", "fechaAplicacion"];

// ─────────────────────────────────────────────── normalizacion de valores

/** Llave del dedup. Sin esto, todas las tasas mienten. */
export function normalizarEmail(v: unknown): string | null {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s || !s.includes("@")) return null;
  return s;
}

export function limpiar(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Piso de plausibilidad. Una fecha anterior a esto no es una fecha: es un CENTINELA
 * de "vacio" que alguna herramienta escribio en la celda.
 *
 * No es un numero al azar. Los dos centinelas de la familia son `1/1/0001` (el que
 * aparecio en una hoja real) y `30/12/1899` (el cero de Excel y de Google Sheets), y
 * el dato legitimo mas viejo de la base es de mediados de 2026. El ano 2000 queda a
 * mas de dos decadas del dato real mas antiguo y a un siglo del centinela mas nuevo:
 * no hay forma de que descarte algo real ni de que deje pasar uno de los dos.
 */
const ANO_MINIMO_PLAUSIBLE = 2000;

/**
 * Las hojas entregan fechas en formato colombiano: d/m/yyyy hh:mm:ss.
 * `new Date()` las lee como mes/dia y produce fechas equivocadas en silencio,
 * que es peor que fallar.
 *
 * Y un centinela de "vacio" tampoco es una fecha (18-sep). `1/1/0001 0:00:00` es
 * sintacticamente valido, asi que se parseaba sin un solo error y entraba a la base
 * como el 1 de enero del ano 1. Esas filas caen fuera de TODO rango, asi que dejan
 * de contar como lead sin que nada falle y sin que la cifra se vea rara: en un
 * programa de `production` eran el 39% de las personas. Un centinela se devuelve
 * como `null`, que es lo que de verdad significa, y el dedup ya sabe tratar una fila
 * sin fecha (F-02). El detalle del incidente esta en `docs/agents/handoff.md`.
 */
export function parsearFecha(v: unknown): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const [, d, mes, a, h = "0", min = "0", seg = "0"] = m;
    const p2 = (n: string) => n.padStart(2, "0");
    // El desplazamiento va explicito, no se lo deja al entorno. El constructor de
    // componentes (new Date(a, m, d, ...)) los interpreta en la zona local del
    // proceso: en la maquina de Michael eso es UTC-5 y en una funcion de Vercel es
    // UTC, asi que la misma fila producia dos instantes distintos sobre una columna
    // timestamptz. Colombia no tiene horario de verano: siempre es -05:00.
    const f = new Date(
      `${a}-${p2(mes)}-${p2(d)}T${p2(h)}:${p2(min)}:${p2(seg)}-05:00`,
    );
    return plausible(f);
  }

  // ISO u otros formatos que Date si entiende sin ambiguedad
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const f = new Date(s);
    return plausible(f);
  }

  return null;
}

/** Una fecha invalida o anterior al piso no es una fecha. Ver `ANO_MINIMO_PLAUSIBLE`. */
function plausible(f: Date): Date | null {
  if (Number.isNaN(f.getTime())) return null;
  return f.getUTCFullYear() < ANO_MINIMO_PLAUSIBLE ? null : f;
}
