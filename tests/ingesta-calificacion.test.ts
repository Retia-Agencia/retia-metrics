import { describe, expect, it } from "vitest";
import { calificarEnvio, esquemaCalificacion, type ConfigCalificacion } from "@/lib/ingesta/calificacion";

/**
 * T2 y T4 — DESCONECTADO de la ingesta (ADR 0054, enmienda del 27-sep; ticket 051): el
 * CRM ya no califica, el Estado lo pone el formulario. Estos tests se quedan porque el
 * modulo sigue en el repo (decision A8, `docs/plan.md` §7) y tiene que compilar y dar los
 * TRES valores de la hoja. Las cuatro reglas del Apps Script, en su orden, ahora sobre
 * `descartado` / `setteo_no_calificado` / `con_calendly`.
 */

const PAGO = "¿Estás dispuesto y en la capacidad de invertir 1.500 USD en ti?";
const AGENDA = "Agenda aquí tu entrevista";
const INGRESO = "¿Cuánto ganas mensualmente? (en dólares)";

const CONFIG: ConfigCalificacion = {
  preguntaPago: PAGO,
  respuestasSinRecursos: ["No, en este momento no cuento con los recursos"],
  campoAgenda: AGENDA,
};

const envio = (pago: string | null, agenda: string | null = null, extra: Record<string, string | null> = {}) => ({
  [PAGO]: pago,
  [AGENDA]: agenda,
  ...extra,
});

describe("calificarEnvio", () => {
  it.each([
    ["sin respuesta de pago (incompleto) es Descartado", envio(null, "https://calendly.com/x"), "descartado"],
    [
      "sin recursos, aunque traiga agenda, es Descartado",
      envio("No, en este momento no cuento con los recursos", "https://calendly.com/x"),
      "descartado",
    ],
    ["con agenda es Con Calendly", envio("Sí, pero necesito facilidades de pago", "https://calendly.com/x"), "con_calendly"],
    ["puede pagar y no agendo es Setteo No Calificado", envio("Sí, pero necesito facilidades de pago"), "setteo_no_calificado"],
  ])("%s", (_, respuestas, esperado) => {
    const r = calificarEnvio(respuestas, CONFIG);
    expect(r.ok && r.calificacion).toBe(esperado);
  });

  it("compara encabezados y respuestas sin acentos ni mayusculas", () => {
    const r = calificarEnvio(
      {
        "¿ESTAS DISPUESTO Y EN LA CAPACIDAD DE INVERTIR 1.500 USD EN TI?": "no, en este momento NO cuento con los recursos",
        "Agenda aqui tu entrevista": null,
      },
      CONFIG,
    );
    expect(r.ok && r.calificacion).toBe("descartado");
  });

  it("una pregunta configurada que el envio NO trae es un error, no una respuesta vacia", () => {
    expect(calificarEnvio({ [AGENDA]: null }, CONFIG)).toEqual({ ok: false, faltan: [PAGO] });
  });

  it("sin pesos no hay puntaje: no se inventa", () => {
    const r = calificarEnvio(envio("Sí"), CONFIG);
    expect(r.ok && [r.puntaje, r.versionPuntaje]).toEqual([null, null]);
  });

  it("el puntaje suma por texto de respuesta, y cada escala de ingreso tiene sus propias reglas", () => {
    const config: ConfigCalificacion = {
      ...CONFIG,
      puntaje: {
        version: 2,
        reglas: [
          { pregunta: INGRESO, respuesta: "$1.500 - $3.000 USD", puntos: 20 },
          // La escala vieja del mismo formulario: otro texto, otra regla.
          { pregunta: INGRESO, respuesta: "$1.000 - $3.000 USD", puntos: 15 },
          { pregunta: PAGO, respuesta: "Sí, tengo la disposición y capacidad de invertir en este momento", puntos: 30 },
        ],
      },
    };
    const r = calificarEnvio(
      envio("Sí, tengo la disposición y capacidad de invertir en este momento", null, { [INGRESO]: "$1.000 - $3.000 USD" }),
      config,
    );
    expect(r.ok && [r.puntaje, r.versionPuntaje]).toEqual([45, 2]);
  });

  it("una pregunta de los pesos que el envio no trae deja el puntaje NULO, no en cero", () => {
    const config: ConfigCalificacion = {
      ...CONFIG,
      puntaje: { version: 1, reglas: [{ pregunta: "Pregunta renombrada", respuesta: "x", puntos: 5 }] },
    };
    const r = calificarEnvio(envio("Sí"), config);
    expect(r.ok && [r.calificacion, r.puntaje, r.faltanParaPuntaje]).toEqual(["setteo_no_calificado", null, ["Pregunta renombrada"]]);
  });

  it("el esquema rechaza una configuracion a medias", () => {
    expect(esquemaCalificacion.safeParse({ preguntaPago: PAGO }).success).toBe(false);
    expect(esquemaCalificacion.safeParse(CONFIG).success).toBe(true);
  });
});
