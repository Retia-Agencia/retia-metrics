/**
 * Fixtures con la FORMA de la pagina publica de Grain (verificada el 29-oct-2026 contra un link
 * real de solo lectura), con texto inventado: ningun dato de un lead entra al repo.
 */
export const DATA = {
  results: [
    [3836, "Hola,", 3917],
    [3933, "Luis,", 4194],
    [4259, "¿cómo", 4340],
    [4356, "estás?", 4763],
    [6841, "Bien,", 7177],
    [7200, "gracias.", 7600],
  ],
  speakers: [
    { id: "s-1", name: "Speaker 1" },
    { id: "s-2", name: "Speaker 2" },
  ],
  speakerRanges: [
    { speakerId: "s-1", startIndex: 0, endIndex: 3, startMs: 3836, endMs: 4763 },
    { speakerId: "s-2", startIndex: 4, endIndex: 5, startMs: 6841, endMs: 7600 },
  ],
};

function escapar(json: unknown): string {
  return JSON.stringify(json).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

export function paginaDeGrain(opciones: { state?: string; data?: unknown; sinMeta?: boolean; status?: string } = {}): string {
  const grabacion = {
    id: "g-1",
    state: "PROCESSED",
    title: "Llamada",
    transcript: { data: "data" in opciones ? opciones.data : DATA, state: opciones.state ?? "PROCESSED", language: "es" },
  };
  return `<!DOCTYPE html><html><head>
    <meta name="grain:status" content="${opciones.status ?? "ok"}">
    ${opciones.sinMeta ? "" : `<meta name="grain:recording:json" content="${escapar(grabacion)}">`}
  </head><body></body></html>`;
}

