import { z } from "zod";
import type { CampoEnvio, EntradaEnvio } from "./envio";
import { resolverContra } from "./adaptador-typeform";
import type { OpcionesAdaptador } from "./proveedores";

export const payloadDaptaSchema = z
  .object({
    id: z.string(),
    type: z.literal("form.submission"),
    phase: z.enum(["partial", "complete"]),
    submittedAt: z.string().datetime({ offset: true }),
    form: z.object({ id: z.string(), name: z.string() }).passthrough(),
    submission: z
      .object({
        id: z.string(),
        sessionId: z.string(),
        score: z.number().optional(),
        outcome: z.string().nullable().optional(),
      })
      .passthrough(),
    data: z.record(z.string(), z.unknown()),
    utm: z.record(z.string(), z.string()),
    visit: z
      .object({
        // Dapta los manda null cuando no los conoce (`WebhookVisit`): exigir texto botaria el envio.
        pageUri: z.string().nullable(),
        pageName: z.string().nullable(),
        embedded: z.boolean(),
        hutk: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type PayloadDapta = z.infer<typeof payloadDaptaSchema>;

const MAPEO_POR_DEFECTO: Partial<Record<CampoEnvio, string[]>> = {
  nombre: ["nombre"],
  correo: ["email", "correo"],
  telefono: ["whatsapp", "telefono"],
};

const CAMPOS_UTM = ["source", "medium", "campaign", "content", "term"] as const;

function textoPlano(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (Array.isArray(valor)) return valor.map(String).join(", ");
  if (["string", "number", "boolean"].includes(typeof valor)) return String(valor);
  return null;
}

function tieneNombreDividido(valor: Record<string, unknown>): boolean {
  return Object.hasOwn(valor, "firstname") || Object.hasOwn(valor, "lastname");
}

function nombreDividido(valor: Record<string, unknown>): string | null {
  const nombre = [textoPlano(valor.firstname), textoPlano(valor.lastname)]
    .filter((parte): parte is string => parte !== null && parte.trim() !== "")
    .join(" ")
    .trim();
  return nombre === "" ? null : nombre;
}

function aplanarObjeto(
  columnas: Record<string, unknown>,
  prefijo: string,
  valor: Record<string, unknown>,
) {
  for (const [parte, contenido] of Object.entries(valor)) {
    const llave = `${prefijo}.${parte}`;
    if (contenido !== null && !Array.isArray(contenido) && typeof contenido === "object") {
      aplanarObjeto(columnas, llave, contenido as Record<string, unknown>);
    } else {
      columnas[llave] = textoPlano(contenido);
    }
  }
}

/**
 * La entrega de prueba del editor de Dapta ("enviar prueba" en la destinacion webhook):
 * va firmada y con la forma real, pero con `data.test: true`, `submission.id
 * "test-submission"` y respuestas de muestra (`sample@example.com`). Ingerirla crearia un
 * lead falso en produccion sin un solo error, asi que se rechaza: el sobre queda guardado
 * con el error y la ruta responde 200, que es justo lo que el editor necesita ver.
 */
export function esEntregaDePrueba(payload: PayloadDapta): boolean {
  return payload.data.test === true || payload.submission.id === "test-submission";
}

/** Convierte un evento de Dapta Forms a la entrada comun de la ingesta. */
export function entradaDesdeDapta(
  payload: PayloadDapta,
  opciones: OpcionesAdaptador,
): EntradaEnvio {
  if (esEntregaDePrueba(payload)) {
    throw new Error("Entrega de prueba de Dapta: llego bien y no se ingiere.");
  }
  const mapeo: Partial<Record<CampoEnvio, string | string[]>> = {
    ...MAPEO_POR_DEFECTO,
    utmSource: "utm_source",
    utmMedium: "utm_medium",
    utmCampaign: "utm_campaign",
    utmId: "utm_id",
    utmContent: "utm_content",
    utmTerm: "utm_term",
    fechaEnvio: "__submitted_at",
    token: "__token",
    estadoHoja: "__estado",
    ...opciones.mapeo?.campos,
  };
  // La plantilla del programa habla en titulos de Typeform ("correo electronico", 117) y
  // vale para todas sus fuentes: si pisara las llaves fijas de Dapta, ningun envio de Dapta
  // de ese programa encontraria su correo. Lo configurado se busca primero; si no casa,
  // las llaves fijas del paso.
  for (const [campo, fijas] of Object.entries(MAPEO_POR_DEFECTO) as [CampoEnvio, string[]][]) {
    const configurado = opciones.mapeo?.campos?.[campo];
    if (configurado === undefined) continue;
    mapeo[campo] = [...(Array.isArray(configurado) ? configurado : [configurado]), ...fijas];
  }
  const patronesNombre = mapeo.nombre;
  const buscadosNombre = patronesNombre
    ? Array.isArray(patronesNombre)
      ? patronesNombre
      : [patronesNombre]
    : [];
  const columnas: Record<string, unknown> = {};

  for (const [llave, valor] of Object.entries(payload.data)) {
    if (valor !== null && !Array.isArray(valor) && typeof valor === "object") {
      const objeto = valor as Record<string, unknown>;
      const esNombre = resolverContra([llave], buscadosNombre) !== undefined;
      if (esNombre || tieneNombreDividido(objeto)) columnas[llave] = nombreDividido(objeto);
      else aplanarObjeto(columnas, llave, objeto);
    } else {
      columnas[llave] = textoPlano(valor);
    }
  }

  for (const campo of CAMPOS_UTM) columnas[`utm_${campo}`] = payload.utm[campo] ?? null;

  const outcome = payload.submission.outcome ?? null;
  const [estado, leadValue, leadQuality] = outcome?.split("|") ?? [];
  columnas.outcome = outcome;
  columnas["__estado"] = estado ?? "";
  columnas["__submitted_at"] = payload.submittedAt;
  columnas["__token"] = payload.submission.id;
  columnas["form.id"] = payload.form.id;
  columnas["form.name"] = payload.form.name;
  if (payload.visit) columnas["visit.pageUri"] = payload.visit.pageUri;

  const campos: Partial<Record<CampoEnvio, string>> = {};
  for (const [campo, patron] of Object.entries(mapeo)) {
    const buscados = Array.isArray(patron) ? patron : [patron];
    const encontrado = resolverContra(Object.keys(columnas), buscados);
    if (encontrado !== undefined) campos[campo as CampoEnvio] = encontrado;
  }

  const puntaje =
    payload.submission.score !== undefined && Number.isFinite(payload.submission.score)
      ? Math.round(payload.submission.score)
      : null;
  const valorOAusente = (valor: string | undefined): string | null =>
    valor === undefined || valor === "" ? null : valor;

  return {
    sourceId: opciones.sourceId,
    zona: opciones.zona,
    posicion: null,
    columnas,
    campos,
    esParcial: payload.phase === "partial",
    linkAgenda: null,
    puntaje,
    leadValue: valorOAusente(leadValue),
    leadQuality: valorOAusente(leadQuality),
  };
}
