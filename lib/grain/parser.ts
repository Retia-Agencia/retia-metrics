import { ErrorDeGrain } from "./errores";

/**
 * El parser de la pagina publica de Grain (ADR 0112 punto 1). Puro: recibe el HTML, devuelve
 * el crudo o lanza `ErrorDeGrain`. Grain embebe la grabacion como JSON en el atributo
 * `content` de `<meta name="grain:recording:json">`, con las comillas escapadas como entidades
 * HTML. Verificado el 29-oct-2026 contra un link real; si cambia, falla con `formato_cambio`.
 */

/** Una palabra: [inicio ms, texto, fin ms]. */
export type PalabraDeGrain = [number, string, number];

/** `transcript.data` tal como lo sirve Grain. Es lo que se guarda en `transcripciones.crudo`. */
export interface TranscriptCrudo {
  results: PalabraDeGrain[];
  speakers: { id: string; name: string }[];
  /** `startIndex` y `endIndex` son indices INCLUSIVOS dentro de `results`. */
  speakerRanges: { speakerId: string; startIndex: number; endIndex: number; startMs: number; endMs: number }[];
}

export interface SegmentoDeHablante {
  hablante: string;
  inicioMs: number;
  finMs: number;
  texto: string;
}

const ENTIDADES: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", "#39": "'" };

function desescaparHtml(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entero, nombre: string) => {
    if (nombre[0] === "#") {
      const codigo = nombre[1].toLowerCase() === "x" ? parseInt(nombre.slice(2), 16) : parseInt(nombre.slice(1), 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : entero;
    }
    return ENTIDADES[nombre.toLowerCase()] ?? entero;
  });
}

function esPalabra(valor: unknown): valor is PalabraDeGrain {
  return (
    Array.isArray(valor) &&
    valor.length >= 3 &&
    typeof valor[0] === "number" &&
    typeof valor[1] === "string" &&
    typeof valor[2] === "number"
  );
}

/** Valida la FORMA del crudo: lo que el codigo despues da por hecho. */
export function validarCrudo(valor: unknown): TranscriptCrudo {
  const d = valor as Partial<TranscriptCrudo> | null;
  if (
    !d ||
    !Array.isArray(d.results) ||
    !Array.isArray(d.speakers) ||
    !Array.isArray(d.speakerRanges) ||
    !d.results.every(esPalabra) ||
    !d.speakers.every((s) => s && typeof s.id === "string" && typeof s.name === "string") ||
    !d.speakerRanges.every(
      (r) =>
        r &&
        typeof r.speakerId === "string" &&
        Number.isInteger(r.startIndex) &&
        Number.isInteger(r.endIndex) &&
        typeof r.startMs === "number" &&
        typeof r.endMs === "number",
    )
  ) {
    throw new ErrorDeGrain("formato_cambio", "transcript.data no tiene la forma esperada");
  }
  return { results: d.results, speakers: d.speakers, speakerRanges: d.speakerRanges };
}

export function parsearPaginaDeGrain(html: string): TranscriptCrudo {
  const meta = /<meta\s+name="grain:recording:json"\s*,?\s*content="([^"]*)"/i.exec(html);
  if (!meta) {
    // Una nota privada o borrada sirve una pagina sin el JSON pero con su estado en un meta.
    const estado = /<meta\s+name="grain:status"\s*,?\s*content="([^"]*)"/i.exec(html)?.[1];
    if (estado && estado !== "ok") throw new ErrorDeGrain("bloqueado", `grain:status=${estado}`);
    throw new ErrorDeGrain("formato_cambio", "no hay grain:recording:json");
  }
  let grabacion: { state?: unknown; transcript?: { state?: unknown; data?: unknown } };
  try {
    grabacion = JSON.parse(desescaparHtml(meta[1]));
  } catch {
    throw new ErrorDeGrain("formato_cambio", "grain:recording:json no es JSON");
  }
  const estado = grabacion.transcript?.state ?? grabacion.state;
  if (estado !== undefined && estado !== "PROCESSED") throw new ErrorDeGrain("no_procesado", String(estado));
  if (!grabacion.transcript?.data) throw new ErrorDeGrain("formato_cambio", "no hay transcript.data");
  const crudo = validarCrudo(grabacion.transcript.data);
  if (crudo.results.length === 0) throw new ErrorDeGrain("sin_transcript");
  return crudo;
}

/** Los turnos de habla en orden: hablante, tiempos y texto. Lo que consume la extraccion (329). */
export function segmentosDelTranscript(crudo: TranscriptCrudo): SegmentoDeHablante[] {
  const nombres = new Map(crudo.speakers.map((s) => [s.id, s.name]));
  return crudo.speakerRanges.map((r) => ({
    hablante: nombres.get(r.speakerId) ?? "Desconocido",
    inicioMs: r.startMs,
    finMs: r.endMs,
    texto: crudo.results
      .slice(r.startIndex, r.endIndex + 1)
      .map((p) => p[1])
      .join(" "),
  }));
}
