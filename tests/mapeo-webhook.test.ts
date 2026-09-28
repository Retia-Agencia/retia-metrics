import { describe, expect, it } from "vitest";
import { mapeoWebhookDesdeFuente } from "@/lib/ingesta/mapeo-webhook";

/**
 * Tarea B del ticket 106: la fuente webhook resuelve su mapeo con la MISMA precedencia
 * que la hoja (fuente ← plantilla del programa ← defecto) y en el MISMO modulo
 * (`combinarMapeo`). Y traduce el vocabulario de la hoja (`emailNormalizado`,
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
      null,
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

  it("sin fuente ni plantilla, cae al defecto (MAPEO_FORMULARIO) para el contenido", () => {
    const { campos } = mapeoWebhookDesdeFuente(null, null);
    // El defecto de la hoja trae los patrones estandar del formulario.
    expect(campos.correo).toBe("correo electronico");
    expect(campos.telefono).toBe("whatsapp");
    expect(campos.nombre).toBe("nombre completo");
  });

  it("🩸 la agenda por DEFECTO no cuenta: solo la que pone la fuente o la plantilla", () => {
    // MAPEO_FORMULARIO trae un patron de agenda que le sirve a la hoja; para el webhook
    // subiria un envio a con_calendly sin que nadie lo configurara (ADR 0054, 2a
    // enmienda: cual pregunta es la de agenda es CONFIGURACION, no heuristica).
    const soloDefecto = mapeoWebhookDesdeFuente(null, null);
    expect(soloDefecto.campoAgenda).toBeUndefined();

    const enLaFuente = mapeoWebhookDesdeFuente({ agenda: "Agenda aquí tu entrevista" }, null);
    expect(enLaFuente.campoAgenda).toBe("Agenda aquí tu entrevista");

    const enLaPlantilla = mapeoWebhookDesdeFuente(null, { agenda: "Reserva tu llamada" });
    expect(enLaPlantilla.campoAgenda).toBe("Reserva tu llamada");
  });

  it("los campos no promovidos (ingreso, motivo, urgencia...) no ensucian el mapeo del Envio", () => {
    const { campos } = mapeoWebhookDesdeFuente(
      { ingresoDeclarado: "¿Cuánto ganas?", porQueAplico: "¿Qué te motivó?", urgencia: "¿Qué tan urgente?" },
      null,
    );
    // Solo los campos de CampoEnvio (mas el defecto). Ninguna llave rara del vocabulario
    // de la hoja se cuela como campo del Envio.
    for (const k of Object.keys(campos)) {
      expect(["correo", "telefono", "nombre", "utmSource", "utmMedium", "utmCampaign"]).toContain(k);
    }
  });

  it("una agenda como lista toma el primer titulo", () => {
    const { campoAgenda } = mapeoWebhookDesdeFuente(
      { agenda: ["Agenda aquí tu entrevista", "Reserva"] },
      null,
    );
    expect(campoAgenda).toBe("Agenda aquí tu entrevista");
  });
});
