import { describe, expect, it } from "vitest";
import {
  entradaDesdeTypeform,
  estadoConAgenda,
  payloadTypeformSchema,
  traeLinkDeCalendly,
  type PayloadTypeform,
} from "@/lib/ingesta/adaptador-typeform";
import { construirEnvio } from "@/lib/ingesta/envio";
import completo from "./fixtures/typeform-completo.json";
import parcial from "./fixtures/typeform-parcial.json";

/**
 * El adaptador de Typeform (ticket 106, ADR 0055). Funcion PURA: se prueba sin base.
 * Lo que un bug aqui hace no es fallar, es traducir mal un lead sin un solo error, asi
 * que cada regla tiene su caso:
 *  - respuestas por pregunta (titulo como llave), UTM de hidden, token, parcialidad;
 *  - el agendo (ADR 0054, segunda enmienda), por fila;
 *  - que el resultado, pasado por `construirEnvio`, dé la identidad correcta.
 */

// La pregunta de agenda la dice el mapeo de la fuente (ADR 0012), no el codigo.
const OPCIONES = {
  sourceId: "src-1",
  zona: "America/Bogota",
  mapeo: { campoAgenda: "Agenda aquí tu entrevista" },
};

function payload(): PayloadTypeform {
  return payloadTypeformSchema.parse(completo);
}

describe("entradaDesdeTypeform", () => {
  it("las respuestas van por titulo de pregunta, y los UTM salen de hidden", () => {
    const entrada = entradaDesdeTypeform(payload(), OPCIONES);
    expect(entrada.columnas["Correo electrónico"]).toBe("Ana.Perez@Correo.co");
    expect(entrada.columnas["WhatsApp"]).toBe("+57 300 123 4567");
    expect(entrada.columnas["¿Cuánto puedes invertir?"]).toBe("Sí, cuento con los recursos");
    expect(entrada.columnas["utm_source"]).toBe("facebook");
    expect(entrada.columnas["utm_campaign"]).toBe("tactical-septiembre");
  });

  it("el token, la fecha y el programa/fuente salen del sobre, no del payload de contenido", () => {
    const entrada = entradaDesdeTypeform(payload(), OPCIONES);
    expect(entrada.sourceId).toBe("src-1");
    expect(entrada.posicion).toBeNull();
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.token).toBe("tok-completo-001");
    expect(r.envio.fechaEnvio?.toISOString()).toBe("2026-09-20T15:00:00.000Z");
    expect(r.envio.esParcial).toBe(false);
  });

  it("construirEnvio normaliza el correo y el telefono desde la entrada del adaptador", () => {
    const entrada = entradaDesdeTypeform(payload(), OPCIONES);
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.identidad.correo).toBe("ana.perez@correo.co");
    expect(r.envio.identidad.telefono).toBe("573001234567");
    expect(r.envio.utmSource).toBe("facebook");
  });

  it("el completo que agenda llega como con_calendly (setteo + link EN la pregunta mapeada)", () => {
    const entrada = entradaDesdeTypeform(payload(), OPCIONES);
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // La variable decia setteo_no_calificado; el link de Calendly en la pregunta de
    // agenda (que el mapeo de la fuente nombra) la sube.
    expect(r.envio.estado).toBe("con_calendly");
  });

  it("SIN agenda en el mapeo de la fuente NO sube, aunque el envio traiga el link", () => {
    // Mismo payload con el link de Calendly, pero la fuente no mapeo la pregunta de
    // agenda: la regla dura impide adivinarla por el contenido.
    const entrada = entradaDesdeTypeform(payload(), { sourceId: "src-1", zona: "America/Bogota" });
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.estado).toBe("setteo_no_calificado");
  });

  it("el parcial no trae submitted_at (fecha null) y queda marcado por el event_type", () => {
    const entrada = entradaDesdeTypeform(payloadTypeformSchema.parse(parcial), OPCIONES);
    expect(entrada.esParcial).toBe(true);
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.esParcial).toBe(true);
    expect(r.envio.fechaEnvio).toBeNull();
    expect(r.envio.token).toBe("tok-parcial-001");
  });

  it("dos preguntas con el mismo titulo no se pisan en silencio", () => {
    const p = payload();
    p.form_response.definition!.fields = [
      { id: "a", title: "Notas" },
      { id: "b", title: "Notas" },
    ];
    p.form_response.answers = [
      { field: { id: "a" }, type: "text", text: "uno" },
      { field: { id: "b" }, type: "text", text: "dos" },
    ];
    const entrada = entradaDesdeTypeform(p, OPCIONES);
    expect(entrada.columnas["Notas"]).toBe("uno");
    expect(entrada.columnas["Notas (2)"]).toBe("dos");
  });
});

describe("entradaDesdeTypeform — variables genéricas (punto E del ticket 106)", () => {
  it("captura TODAS las variables (texto y número) como columnas con prefijo reservado", () => {
    const p = payload();
    p.form_response.variables = [
      { key: "estado", type: "text", text: "setteo_no_calificado" },
      { key: "score", type: "number", number: 42 },
      { key: "segmento", type: "text", text: "premium" },
    ];
    const entrada = entradaDesdeTypeform(p, OPCIONES);
    // El prefijo `variable:` mantiene el namespace separado de hidden y de títulos.
    expect(entrada.columnas["variable:score"]).toBe("42");
    expect(entrada.columnas["variable:segmento"]).toBe("premium");
    expect(entrada.columnas["variable:estado"]).toBe("setteo_no_calificado");
  });

  it("una variable desconocida entra sola a respuestas (via construirEnvio), sin tocar código", () => {
    const p = payload();
    p.form_response.variables = [
      { key: "estado", type: "text", text: "setteo_no_calificado" },
      { key: "score", type: "number", number: 7 },
    ];
    const r = construirEnvio(entradaDesdeTypeform(p, OPCIONES));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // `variable:score` no es un campo promovido: cae en respuestas con su llave prefijada.
    expect(r.envio.respuestas["variable:score"]).toBe("7");
  });

  it("un payload SIN la variable estado entra sin Estado y no revienta", () => {
    const p = payload();
    p.form_response.variables = [{ key: "score", type: "number", number: 1 }];
    const r = construirEnvio(entradaDesdeTypeform(p, OPCIONES));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.estado).toBeNull();
    expect(r.envio.estadoHoja).toBeNull();
  });

  it("una fuente que apunta el Estado a OTRA variable la usa", () => {
    const p = payload();
    p.form_response.variables = [
      { key: "estado", type: "text", text: "descartado" }, // la variable estándar
      { key: "clasificacion", type: "text", text: "setteo_no_calificado" }, // la elegida
    ];
    // El mapeo dice que el Estado sale de la variable `clasificacion`, no de `estado`.
    // Sin `campoAgenda` para que el link de Calendly del fixture no suba el Estado y
    // podamos comprobar que la variable elegida se leyó tal cual.
    const entrada = entradaDesdeTypeform(p, {
      sourceId: "src-1",
      zona: "America/Bogota",
      mapeo: { variableEstado: "clasificacion" },
    });
    const r = construirEnvio(entrada);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envio.estado).toBe("setteo_no_calificado");
  });

  it("una variable con el mismo nombre que un hidden NO se pisan (namespaces separados)", () => {
    const p = payload();
    p.form_response.hidden = { utm_source: "facebook", segmento: "de-hidden" };
    p.form_response.variables = [
      { key: "estado", type: "text", text: "setteo_no_calificado" },
      { key: "segmento", type: "text", text: "de-variable" },
    ];
    const entrada = entradaDesdeTypeform(p, OPCIONES);
    // El hidden queda con su nombre crudo; la variable, prefijada. Ninguna borra a la otra.
    expect(entrada.columnas["segmento"]).toBe("de-hidden");
    expect(entrada.columnas["variable:segmento"]).toBe("de-variable");
  });
});

describe("estadoConAgenda (ADR 0054, segunda enmienda) — por fila, agenda del mapeo", () => {
  const AGENDA = "Agenda aquí tu entrevista";
  const conLink = { [AGENDA]: "https://calendly.com/x/y" };
  const sinLink = { [AGENDA]: "" };

  it("setteo_no_calificado + link de Calendly EN la pregunta mapeada = con_calendly", () => {
    expect(estadoConAgenda("setteo_no_calificado", conLink, AGENDA)).toBe("con_calendly");
  });

  it("setteo_no_calificado sin link en la pregunta mapeada se queda igual", () => {
    expect(estadoConAgenda("setteo_no_calificado", sinLink, AGENDA)).toBe("setteo_no_calificado");
  });

  it("SIN pregunta de agenda mapeada NUNCA sube, aunque el texto tenga calendly", () => {
    // La regla dura: cual pregunta es la de agenda lo dice el mapeo, no una heuristica.
    expect(estadoConAgenda("setteo_no_calificado", conLink, undefined)).toBe("setteo_no_calificado");
  });

  it("un link de Calendly en OTRA pregunta (no la mapeada) no cuenta como agendar", () => {
    const respuestas = {
      "Tu sitio web": "https://calendly.com/impostor",
      [AGENDA]: "",
    };
    expect(estadoConAgenda("setteo_no_calificado", respuestas, AGENDA)).toBe("setteo_no_calificado");
  });

  it("descartado NUNCA sube, aunque la pregunta de agenda tenga un link", () => {
    expect(estadoConAgenda("descartado", conLink, AGENDA)).toBe("descartado");
  });

  it("un estado nulo o desconocido se respeta tal cual", () => {
    expect(estadoConAgenda(null, conLink, AGENDA)).toBeNull();
    expect(estadoConAgenda("otra_cosa", conLink, AGENDA)).toBe("otra_cosa");
  });

  it("la pregunta de agenda no vino en el envio: no sube", () => {
    expect(estadoConAgenda("setteo_no_calificado", {}, AGENDA)).toBe("setteo_no_calificado");
  });
});

describe("traeLinkDeCalendly", () => {
  it("reconoce el dominio sin importar mayusculas ni ruta", () => {
    expect(traeLinkDeCalendly("https://Calendly.com/retia/x")).toBe(true);
    expect(traeLinkDeCalendly("CALENDLY.COM")).toBe(true);
  });
  it("un texto sin el dominio o vacio es false", () => {
    expect(traeLinkDeCalendly("https://meet.google.com/x")).toBe(false);
    expect(traeLinkDeCalendly("")).toBe(false);
    expect(traeLinkDeCalendly(null)).toBe(false);
  });
});
