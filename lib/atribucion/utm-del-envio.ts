import { submissions } from "@/lib/db/schema";

export type CampoUtm = "source" | "medium" | "campaign" | "content" | "term" | "id";

/** Una macro sin expandir es un centinela, no un dato atribuible. */
export function esMacro(valor: string | null): boolean {
  return valor?.includes("{{") ?? false;
}

export interface UtmsDelEnvio {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  id: string | null;
}

export const columnasUtmDelEnvio = {
  utmSource: submissions.utmSource,
  utmMedium: submissions.utmMedium,
  utmCampaign: submissions.utmCampaign,
  utmContent: submissions.utmContent,
  utmTerm: submissions.utmTerm,
  utmId: submissions.utmId,
  respuestas: submissions.respuestas,
};

/** Recupera los UTM crudos del envio sin interpretar el significado de cada campo. */
export function utmsDelEnvio(fila: {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  utmId: string | null;
  respuestas: unknown;
}): UtmsDelEnvio {
  const respuestas =
    fila.respuestas !== null && typeof fila.respuestas === "object" && !Array.isArray(fila.respuestas)
      ? (fila.respuestas as Record<string, unknown>)
      : {};
  const leer = (llave: string): string | null => {
    for (const [clave, valor] of Object.entries(respuestas)) {
      if (clave.trim().toLowerCase() === llave && typeof valor === "string" && valor.trim() !== "") {
        return valor;
      }
    }
    return null;
  };

  return {
    source: fila.utmSource,
    medium: fila.utmMedium,
    campaign: fila.utmCampaign,
    content: fila.utmContent ?? leer("utm_content"),
    term: fila.utmTerm ?? leer("utm_term"),
    // Desde el 116 las tres viven en su columna; `respuestas` queda para lo anterior a la 0048.
    id: fila.utmId ?? leer("utm_id"),
  };
}
