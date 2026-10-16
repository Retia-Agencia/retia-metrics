import { z } from "zod";
import { esMacro } from "@/lib/atribucion/utm-del-envio";
import { ESTADO_CON_CALENDLY } from "./calificacion";
import { esCorreoDePrueba, resolverContra } from "./adaptador-typeform";
import type { CampoEnvio, EntradaEnvio } from "./envio";
import type { OpcionesAdaptador } from "./proveedores";

const respuestaForm30xSchema = z
  .object({
    fieldRef: z.string().optional(),
    type: z.string(),
    question: z.string(),
    value: z.unknown(),
    label: z.string().optional(),
    choices: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const payloadForm30xSchema = z
  .object({
    event: z.enum(["response.completed", "response.partial"]),
    formId: z.string(),
    formTitle: z.string(),
    responseId: z.string(),
    submittedAt: z.string().datetime({ offset: true }),
    answers: z.array(respuestaForm30xSchema),
    hidden: z.record(z.string(), z.string()).default({}),
    score: z.number().optional(),
    tags: z.array(z.string()).default([]),
    variables: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type PayloadForm30x = z.infer<typeof payloadForm30xSchema>;

const CAMPOS_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
] as const;

interface ValorCalendly {
  scheduled: true;
  invitee: string;
}

function calendlyAgendado(valor: unknown): valor is ValorCalendly {
  return (
    typeof valor === "object" &&
    valor !== null &&
    (valor as { scheduled?: unknown }).scheduled === true &&
    typeof (valor as { invitee?: unknown }).invitee === "string"
  );
}

function textoDeRespuesta(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof valor)) return String(valor);
  return null;
}

function esTagDeCalidad(tag: string): boolean {
  return ["high", "mid", "medium", "low"].includes(tag.trim().toLowerCase());
}

/** Convierte una respuesta de Form30x a la entrada comun de la ingesta. */
export function entradaDesdeForm30x(
  payload: PayloadForm30x,
  opciones: OpcionesAdaptador,
): EntradaEnvio {
  const columnas: Record<string, unknown> = {};
  for (const respuesta of payload.answers) {
    columnas[respuesta.question] =
      respuesta.type === "calendly"
        ? calendlyAgendado(respuesta.value)
          ? respuesta.value.invitee
          : null
        : respuesta.label ?? textoDeRespuesta(respuesta.value);
  }

  for (const [llave, valor] of Object.entries(payload.hidden)) {
    columnas[llave] = valor.trim() === "" || esMacro(valor) ? null : valor;
  }
  for (const campo of CAMPOS_UTM) columnas[campo] ??= null;

  const respuestaCalendly = payload.answers.find(
    (respuesta) => respuesta.type === "calendly" && calendlyAgendado(respuesta.value),
  );
  const linkAgenda = respuestaCalendly && calendlyAgendado(respuestaCalendly.value)
    ? respuestaCalendly.value.invitee
    : null;

  columnas["__submitted_at"] = payload.submittedAt;
  columnas["__token"] = payload.responseId;
  columnas["__estado"] = linkAgenda === null ? "" : ESTADO_CON_CALENDLY;
  columnas["form.id"] = payload.formId;
  columnas["form.title"] = payload.formTitle;

  const primeraPregunta = (tipo: string): string | undefined =>
    payload.answers.find((respuesta) => respuesta.type === tipo)?.question;
  const mapeo: Partial<Record<CampoEnvio, string | string[]>> = {
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
  for (const [campo, tipo] of [["correo", "email"], ["telefono", "phone_number"]] as const) {
    const respaldo = primeraPregunta(tipo);
    if (respaldo === undefined) continue;
    const configurado = opciones.mapeo?.campos?.[campo];
    mapeo[campo] = configurado === undefined
      ? respaldo
      : [...(Array.isArray(configurado) ? configurado : [configurado]), respaldo];
  }

  const campos: Partial<Record<CampoEnvio, string>> = {};
  for (const [campo, patron] of Object.entries(mapeo)) {
    const encontrado = resolverContra(
      Object.keys(columnas),
      Array.isArray(patron) ? patron : [patron],
    );
    if (encontrado !== undefined) campos[campo as CampoEnvio] = encontrado;
  }

  const correo = campos.correo === undefined ? null : columnas[campos.correo];
  if (esCorreoDePrueba(typeof correo === "string" ? correo : null)) {
    throw new Error("Entrega de prueba de Form30x (correo de dominio reservado): llego bien y no se ingiere.");
  }

  const leadQuality = payload.tags.find(esTagDeCalidad) ?? null;
  const tagsDeValor = payload.tags.filter((tag) => !esTagDeCalidad(tag));

  return {
    sourceId: opciones.sourceId,
    zona: opciones.zona,
    posicion: null,
    columnas,
    campos,
    // Form30x no manda parciales. El ticket 272 usa este evento al traducir
    // respuestas de `/responses` con `completed: false` al contrato del adaptador.
    esParcial: payload.event === "response.partial",
    linkAgenda,
    puntaje: payload.score !== undefined && Number.isFinite(payload.score)
      ? Math.round(payload.score)
      : null,
    leadQuality,
    leadValue: tagsDeValor.length === 1 ? tagsDeValor[0] : null,
  };
}
