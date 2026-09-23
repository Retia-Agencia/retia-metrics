import { describe, expect, it } from "vitest";
import { calificarEnvio, esquemaCalificacion, type ConfigCalificacion } from "@/lib/ingesta/calificacion";

/**
 * T2 y T4: las cuatro reglas del Apps Script, en su orden, y el puntaje por texto de
 * respuesta. Validado el 23-sep contra el historico real: 6.397 de 6.400 envios dan el
 * mismo Estado que escribio la hoja (las 3 diferencias son ediciones a mano).
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
    ["sin respuesta de pago", envio(null, "https://calendly.com/x"), "incompleto"],
    [
      "sin recursos, aunque traiga agenda",
      envio("No, en este momento no cuento con los recursos", "https://calendly.com/x"),
      "sin_recursos",
    ],
    ["con agenda", envio("Sí, pero necesito facilidades de pago", "https://calendly.com/x"), "con_agenda"],
    ["todo lo demas", envio("Sí, pero necesito facilidades de pago"), "setteo"],
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
    expect(r.ok && r.calificacion).toBe("sin_recursos");
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
    expect(r.ok && [r.calificacion, r.puntaje, r.faltanParaPuntaje]).toEqual(["setteo", null, ["Pregunta renombrada"]]);
  });

  it("el esquema rechaza una configuracion a medias", () => {
    expect(esquemaCalificacion.safeParse({ preguntaPago: PAGO }).success).toBe(false);
    expect(esquemaCalificacion.safeParse(CONFIG).success).toBe(true);
  });
});
