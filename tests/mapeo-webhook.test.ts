import { describe, expect, it } from "vitest";
import { campoAgendaDeFuente, mapeoWebhookDesdeFuente } from "@/lib/ingesta/mapeo-webhook";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";

/** El minimo que toda fuente webhook necesita desde el 117: que pregunta trae el correo. */
const CORREO = { emailNormalizado: "correo electronico" };

/**
 * Tarea B del ticket 106: la fuente webhook resuelve su mapeo con la MISMA precedencia
 * que la hoja (fuente ← plantilla del programa) y en el MISMO modulo (`combinarMapeo`),
 * sin defecto del codigo desde el ticket 117. Y traduce el vocabulario de la hoja (`emailNormalizado`,
 * `fechaAplicacion`, `estado`, `agenda`...) al de `CampoEnvio` en UN solo lugar.
 *
 * Funcion PURA: se prueba sin base. Un bug aqui no falla: deja de leer un campo mapeado
 * a mano y en produccion se pierden datos del lead sin un solo error.
 */

describe("mapeoWebhookDesdeFuente — precedencia y traduccion de vocabulario", () => {
  it("traduce el vocabulario de la hoja de produccion a CampoEnvio", () => {
    // Las llaves REALES de una fuente de hoja en produccion (ticket 106): emailNormalizado,
    // telefono, nombre, ... El webhook las tiene que entender igual, no ignorarlas.
    const { campos, campoAgenda } = mapeoWebhookDesdeFuente(
      {
        emailNormalizado: "¿Cuál es tu correo electrónico?",
        telefono: "¿Cuál es tu número de WhatsApp?",
        nombre: "¿Cuál es tu nombre completo?",
        agenda: "Agenda aquí tu entrevista",
      },
      null,
    );
    expect(campos.correo).toBe("¿Cuál es tu correo electrónico?");
    expect(campos.telefono).toBe("¿Cuál es tu número de WhatsApp?");
    expect(campos.nombre).toBe("¿Cuál es tu nombre completo?");
    expect(campoAgenda).toBe("Agenda aquí tu entrevista");
  });

  it("los campos del SOBRE (token, fechaAplicacion, estado) NO se traducen a campos de pregunta", () => {
    // En un webhook token/fecha/estado salen del sobre (`__token`, `__submitted_at`,
    // `__estado`), no de una pregunta. Traducirlos pisaria esas columnas fijas.
    const { campos } = mapeoWebhookDesdeFuente(
      { token: "Token", fechaAplicacion: "Submitted At", estado: "Estado" },
      CORREO,
    );
    expect(campos).not.toHaveProperty("token");
    expect(campos).not.toHaveProperty("fechaEnvio");
    expect(campos).not.toHaveProperty("estadoHoja");
  });

  it("un campo sin ajuste en la fuente hereda de la plantilla del programa", () => {
    const { campos } = mapeoWebhookDesdeFuente(
      { nombre: "El nombre de esta fuente" },
      { emailNormalizado: "Correo en la plantilla del programa" },
    );
    expect(campos.nombre).toBe("El nombre de esta fuente");
    expect(campos.correo).toBe("Correo en la plantilla del programa");
  });

  it("la fuente gana sobre la plantilla del programa", () => {
    const { campos } = mapeoWebhookDesdeFuente(
      { emailNormalizado: "correo de la fuente" },
      { emailNormalizado: "correo de la plantilla" },
    );
    expect(campos.correo).toBe("correo de la fuente");
  });

  it("🩸 sin fuente ni plantilla falla con MapeoInvalidoError: no cae a un defecto que adivina (117)", () => {
    expect(() => mapeoWebhookDesdeFuente(null, null)).toThrow(MapeoInvalidoError);
    expect(() => mapeoWebhookDesdeFuente({}, {})).toThrow(/correo/);
    // Mapear otras cosas no basta: sin el correo no hay lead que identificar.
    expect(() => mapeoWebhookDesdeFuente({ agenda: "Agenda aquí tu entrevista", telefono: "whatsapp" }, null)).toThrow(
      MapeoInvalidoError,
    );
  });

  it("sin defecto, solo lo que dicen la fuente y la plantilla: nada de nombre ni telefono inventados", () => {
    const { campos } = mapeoWebhookDesdeFuente(null, CORREO);
    expect(campos).toEqual({ correo: "correo electronico" });
  });

  it("🩸 la agenda solo la pone la fuente o la plantilla", () => {
    // Cual pregunta es la de agenda es CONFIGURACION, no heuristica (ADR 0061 punto 4).
    expect(mapeoWebhookDesdeFuente(null, CORREO).campoAgenda).toBeUndefined();

    const enLaFuente = mapeoWebhookDesdeFuente({ agenda: "Agenda aquí tu entrevista" }, CORREO);
    expect(enLaFuente.campoAgenda).toBe("Agenda aquí tu entrevista");

    const enLaPlantilla = mapeoWebhookDesdeFuente(null, { ...CORREO, agenda: "Reserva tu llamada" });
    expect(enLaPlantilla.campoAgenda).toBe("Reserva tu llamada");
  });

  it("releer la agenda de un envio guardado no exige el correo (buscar llamada, 096)", () => {
    expect(campoAgendaDeFuente({ agenda: "Agenda aquí tu entrevista" }, null)).toBe("Agenda aquí tu entrevista");
    expect(campoAgendaDeFuente(null, null)).toBeUndefined();
  });

  it("los campos no promovidos (ingreso, motivo, urgencia...) no ensucian el mapeo del Envio", () => {
    const { campos } = mapeoWebhookDesdeFuente(
      { ingresoDeclarado: "¿Cuánto ganas?", porQueAplico: "¿Qué te motivó?", urgencia: "¿Qué tan urgente?" },
      CORREO,
    );
    // Solo los campos de CampoEnvio. Ninguna llave rara del vocabulario
    // de la hoja se cuela como campo del Envio.
    for (const k of Object.keys(campos)) {
      expect(["correo", "telefono", "nombre", "utmSource", "utmMedium", "utmCampaign"]).toContain(k);
    }
  });

  it("una agenda como lista toma el primer titulo", () => {
    const { campoAgenda } = mapeoWebhookDesdeFuente(
      { agenda: ["Agenda aquí tu entrevista", "Reserva"] },
      CORREO,
    );
    expect(campoAgenda).toBe("Agenda aquí tu entrevista");
  });
});
