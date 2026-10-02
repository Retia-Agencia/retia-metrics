import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { estadoDesdeTexto } from "@/lib/ingesta/estado";
import {
  motivoSinEstado,
  resolverEstadoDeLlegada,
  type EstadoDeLlegada,
} from "@/lib/ingesta/estados-llegada";

/**
 * `estadoDesdeTexto` (ticket 051, reescrito en el 117): LIMPIA el texto del Estado, no lo
 * califica ni lo valida. El valor del formulario se guarda tal cual (recortado) y la
 * etiqueta exacta de la hoja se traduce a su valor. Si el valor abre deal lo dice
 * `estados_llegada`, no esta funcion.
 */
describe("estadoDesdeTexto", () => {
  it.each([
    // El valor del formulario tal cual (webhook), el de hoy o uno nuevo.
    ["descartado", "descartado"],
    ["setteo_no_calificado", "setteo_no_calificado"],
    ["con_calendly", "con_calendly"],
    ["con_calendly_sin_agenda", "con_calendly_sin_agenda"],
    ["un_valor_nuevo", "un_valor_nuevo"],
    // La etiqueta exacta de la hoja (traslado desde Sheets).
    ["🗑️ Descartado", "descartado"],
    ["📞 Setteo No Calificado", "setteo_no_calificado"],
    ["📅 Con Calendly", "con_calendly"],
    ["📅 Con Calendly (Juanito)", "con_calendly"],
    // Con blancos alrededor: solo trim, nada mas.
    ["  con_calendly  ", "con_calendly"],
    ["  🗑️ Descartado ", "descartado"],
    // Nada de emparejamiento difuso: un texto que no es etiqueta exacta se guarda como llego.
    ["📅 con calendly", "📅 con calendly"],
    ["CON_CALENDLY", "CON_CALENDLY"],
  ])("guarda %j como %j", (crudo, valor) => {
    expect(estadoDesdeTexto(crudo)).toEqual({ calificacion: valor });
  });

  it("un vacio, un nulo o solo blancos es 'sin estado'", () => {
    expect(estadoDesdeTexto("")).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto("   ")).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto(null)).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto(undefined)).toEqual({ calificacion: null, motivo: "sin estado" });
  });
});

/**
 * Que significa un Estado lo dice la fila del programa (ADR 0061). La comparacion es la del
 * indice unico (`lower(trim())`), y lo que no tiene fila no se adivina.
 */
describe("resolverEstadoDeLlegada y motivoSinEstado", () => {
  const setteo: EstadoDeLlegada = { valor: "setteo_no_calificado", etapaEntrada: "registrado", prioridad: "normal", alertaMinutos: null };
  const estados = new Map([["setteo_no_calificado", setteo]]);

  it("encuentra la fila sin importar mayusculas ni blancos", () => {
    expect(resolverEstadoDeLlegada("setteo_no_calificado", estados)).toBe(setteo);
    expect(resolverEstadoDeLlegada("  SETTEO_no_calificado ", estados)).toBe(setteo);
    expect(motivoSinEstado("Setteo_No_Calificado", estados)).toBeNull();
  });

  it("vacio es 'sin estado'; un valor sin fila es 'no reconocido' con el valor", () => {
    expect(resolverEstadoDeLlegada(null, estados)).toBeNull();
    expect(motivoSinEstado(null, estados)).toBe("sin estado");
    expect(motivoSinEstado("  ", estados)).toBe("sin estado");
    expect(resolverEstadoDeLlegada("otra_cosa", estados)).toBeNull();
    expect(motivoSinEstado("otra_cosa", estados)).toBe("estado no reconocido: otra_cosa");
  });

  it("un programa sin filas no reconoce nada", () => {
    expect(motivoSinEstado("setteo_no_calificado", new Map())).toBe("estado no reconocido: setteo_no_calificado");
  });
});

function fuentesDeIngesta(): { nombre: string; fuente: string }[] {
  const dir = fileURLToPath(new URL("../lib/ingesta/", import.meta.url));
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".ts"))
    .map((nombre) => ({ nombre, fuente: fs.readFileSync(fileURLToPath(new URL(`../lib/ingesta/${nombre}`, import.meta.url)), "utf8") }));
}

/**
 * La ingesta NO calcula el Estado desde las respuestas (ADR 0054, enmienda del 28-sep, y
 * ADR 0061): guarda el que manda el formulario. Este guardian falla si el calculo vuelve a
 * aparecer en `lib/ingesta/`, y si la regla vuelve a comparar contra un valor escrito.
 */
describe("nada en lib/ingesta califica ni decide con un valor escrito", () => {
  it("no hay ni una referencia a calificarEnvio en lib/ingesta", () => {
    expect(fuentesDeIngesta().some(({ fuente }) => fuente.includes("calificarEnvio"))).toBe(false);
  });

  it("🩸 la regla de deals no compara contra un valor del Estado (el 29-sep de Tactical)", () => {
    const regla = fuentesDeIngesta().find((f) => f.nombre === "regla-de-deals.ts")!.fuente;
    // Fuera de los comentarios, ningun valor de Estado aparece como literal.
    const codigo = regla.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const valor of ["descartado", "setteo_no_calificado", "con_calendly"]) {
      expect(codigo, valor).not.toContain(`"${valor}"`);
    }
  });
});

/**
 * B4 de la auditoria 114, cerrado en el 117: los titulos de pregunta de los Typeform de
 * hoy no viven en `lib/ingesta/`. Los dice la plantilla del programa o el mapeo de la
 * fuente; el vocabulario de la hoja (traslado y migracion) vive en `lib/sheets/`.
 *
 * Excepcion nombrada: `adaptador-dapta.ts` (ticket 130). Sus llaves (`email`, `whatsapp`)
 * son las llaves FIJAS de los pasos del formulario de Dapta que genera
 * `docs/dapta/generar-base.mjs`, no titulos de pregunta de Typeform.
 */
const CON_LLAVES_FIJAS = new Set(["adaptador-dapta.ts"]);

describe("ningun titulo de pregunta de Typeform en lib/ingesta", () => {
  it.each(["correo electr", "whatsapp", "nombre completo", "agenda aqu", "celular", "ganas mensualmente"])(
    "%j no aparece en ningun archivo de lib/ingesta como texto",
    (titulo) => {
      const conTitulo = fuentesDeIngesta().filter(({ nombre, fuente }) =>
        !CON_LLAVES_FIJAS.has(nombre) &&
        // Solo dentro de comillas: un comentario que diga "el parcial del WhatsApp" no es un mapeo.
        new RegExp(`["'\`][^"'\`\\n]*${titulo}[^"'\`\\n]*["'\`]`, "i").test(fuente),
      );
      expect(conTitulo.map((f) => f.nombre)).toEqual([]);
    },
  );
});
