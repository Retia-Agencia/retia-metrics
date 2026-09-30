export interface CanalActivo {
  id: string;
  nombre: string;
  utmSource: string | null;
  utmMedium: string;
  areaId: string;
  formato: "plantilla_pauta" | "meta_historico" | "closer" | null;
  activo: boolean;
}

export type ResultadoCanal =
  | { tipo: "canal"; canal: CanalActivo }
  | { tipo: "sin_utm" }
  | { tipo: "sin_clasificar" };

/** Los vacíos y las macros sin expandir no son datos atribuibles. */
export function normalizarUtm(valor: string | null): string | null {
  if (valor === null) return null;
  const limpio = valor.trim();
  if (limpio === "" || limpio.includes("{{")) return null;
  return limpio.toLowerCase();
}

/** Resuelve un envío sin depender de la base ni del orden del catálogo. */
export function resolverCanal(
  envio: { source: string | null; medium: string | null; campaign: string | null },
  catalogo: readonly CanalActivo[],
): ResultadoCanal {
  const source = normalizarUtm(envio.source);
  const medium = normalizarUtm(envio.medium);
  const campaign = normalizarUtm(envio.campaign);

  if (source === null && medium === null && campaign === null) return { tipo: "sin_utm" };
  if (medium === null) return { tipo: "sin_clasificar" };

  const activos = catalogo.filter((canal) => canal.activo);
  const exacto = activos.find(
    (canal) =>
      normalizarUtm(canal.utmSource) === source &&
      canal.utmSource !== null &&
      normalizarUtm(canal.utmMedium) === medium,
  );
  if (exacto) return { tipo: "canal", canal: exacto };

  const comodin = activos.find(
    (canal) => canal.utmSource === null && normalizarUtm(canal.utmMedium) === medium,
  );
  return comodin ? { tipo: "canal", canal: comodin } : { tipo: "sin_clasificar" };
}
