import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Contrato de métricas y datos §8 (2), ADR 0115 N4 (un nombre por concepto): el guardián del Hub
 * (`hub-vocabulario-guardian.test.ts`) caza jerga, no sinónimos. Este caza sinónimos NUEVOS en TODAS las
 * superficies (pantallas, listas, MCP, WhatsApp). Es el borrador previo al glosario de F5: no sabe cuál es
 * el nombre canónico, así que no congela el vocabulario viejo; solo impide que cada concepto gane un nombre más
 * (F1 H-09, H-10, H-11: Show/Realizadas/Asistencia/Llamadas atendidas; Recaudado/Caja/Entró a caja/Confirmado).
 *
 * Por concepto hay dos listas:
 *   - `VIGENTES`: los rótulos que hoy conviven (deuda de F5, con su hallazgo). Sin excepciones zombi: si F5
 *     unifica uno y deja de aparecer, se borra de la lista, y el guardián falla hasta entonces;
 *   - `NUEVOS_PROHIBIDOS`: sinónimos que hoy NO aparecen en ninguna superficie y no deben aparecer.
 * No se vigilan "Conversiones" (nombre de la API de Meta) ni "Reservas" (la definición de Citas lo usa en prosa):
 * son usos legítimos de otra cosa que este guardián, sin contexto, no distingue.
 * Cuando F5 fije el glosario, `VIGENTES` se reduce al nombre canónico y esto pasa a ser el guardián de N4.
 *
 * Qué mira: cadenas visibles (literales y texto de JSX) de `app/`, `components/` y los módulos de `lib/`
 * que arman texto para personas (vocabulario, MCP, reporte de WhatsApp, semáforo), sin comentarios, por palabra
 * completa y con mayúscula inicial. Límite honesto: un sinónimo en minúscula dentro de una frase, o armado por
 * partes (`"Caja" + " del día"`), no se ve; y no entiende contexto: una palabra legítima de otro concepto
 * (p. ej. "Abono" como transacción) está en `VIGENTES` y no se mueve de ahí sin F5.
 */
const RAIZ = process.cwd();
const SUPERFICIES = ["app", "components", "lib/vocabulario-metricas.ts", "lib/mcp", "lib/reporte-whatsapp", "lib/semaforo", "lib/queries"];

type Concepto = { vigentes: Record<string, string>; nuevosProhibidos: string[] };
const CONCEPTOS: Record<string, Concepto> = {
  "cita ocurrida (show)": {
    vigentes: {
      "Show": "H-10: se unifica en F5",
      "Realizadas": "H-10: se unifica en F5",
      "Llamadas atendidas": "H-10: se unifica en F5",
      "Asistencia": "H-10: se unifica en F5",
      "No-show": "H-10 / 353: el no show como complemento nombrado",
      "No show": "H-10 / 353",
      "No asistió": "H-10 / 353",
    },
    nuevosProhibidos: ["Atendidas", "Asistieron", "Presentadas", "Concretadas", "Efectivas"],
  },
  "dinero cobrado": {
    vigentes: {
      "Recaudado": "vocabulario vigente (de lo vendido, sin importar cuándo)",
      "Entró a caja": "vocabulario vigente (abonos con fecha en el periodo)",
      "Caja": "H-11: se unifica en F5",
      "Caja del día": "H-11: se unifica en F5",
      "Confirmado": "H-11: se unifica en F5",
    },
    nuevosProhibidos: ["Cobrado", "Ingresado", "Ingresos", "Facturado", "Recaudo"],
  },
  "venta": {
    vigentes: {
      "Ventas": "vocabulario vigente",
      "Cierres": "H-09: se unifica en F5 (353/358)",
      "Ventas cerradas": "H-09: se unifica en F5",
      "Cupos vendidos": "vocabulario vigente de Hub › Hoy (378)",
    },
    nuevosProhibidos: ["Ventas ganadas", "Cerradas", "Deals ganados"],
  },
  "agenda": {
    vigentes: {
      "Agendas": "H-02: tres universos con el mismo rótulo; se resuelve en F5 con 354/353",
      "Agendadas": "H-02",
      "Citas": "vocabulario vigente",
    },
    nuevosProhibidos: ["Reservadas", "Bookings", "Turnos"],
  },
  "lead y registro": {
    vigentes: { "Leads": "H-04: leads son personas; vocabulario vigente", "Registros": "H-04: registros son envíos; vocabulario vigente" },
    nuevosProhibidos: ["Prospectos", "Postulaciones"],
  },
};

/** Cadenas visibles: literales y texto de JSX. Copia mínima del extractor del guardián del Hub. */
export function cadenasVisibles(fuente: string): string[] {
  const limpio = sinComentarios(fuente);
  const literales = [...limpio.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, ""));
  const jsx = [...limpio.matchAll(/>([^<>{};"]*[A-Za-zÁ-ú][^<>{};"]*)(?=[<{])/g)].map((m) => m[1]);
  return [...literales, ...jsx].filter((t) => !/^[a-z0-9_\-:./]+$/.test(t));
}

export function conteoDe(textos: string[], rotulo: string): number {
  const re = new RegExp(`(?<![A-Za-zÁ-ú0-9_-])${rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-zÁ-ú0-9_-])`);
  return textos.filter((t) => re.test(t)).length;
}

function textosDeLasSuperficies(): string[] {
  return SUPERFICIES.flatMap((s) => {
    const ruta = path.join(RAIZ, s);
    return fs.statSync(ruta).isFile() ? [ruta] : archivos(ruta);
  }).flatMap((f) => cadenasVisibles(fs.readFileSync(f, "utf8")));
}

describe("guardián: un concepto no gana un nombre más (N4)", () => {
  const textos = textosDeLasSuperficies();

  it("ningún sinónimo nuevo prohibido aparece en una superficie", () => {
    const presentes = Object.entries(CONCEPTOS).flatMap(([c, { nuevosProhibidos }]) =>
      nuevosProhibidos.filter((r) => conteoDe(textos, r) > 0).map((r) => `${c}: ${r}`));
    expect(presentes).toEqual([]);
  });

  it("sin excepciones zombi: cada rótulo vigente sigue apareciendo", () => {
    const zombis = Object.entries(CONCEPTOS).flatMap(([c, { vigentes }]) =>
      Object.keys(vigentes).filter((r) => conteoDe(textos, r) === 0).map((r) => `${c}: ${r}`));
    expect(zombis).toEqual([]);
  });

  it("cada rótulo vive en un solo concepto", () => {
    const todos = Object.values(CONCEPTOS).flatMap((c) => [...Object.keys(c.vigentes), ...c.nuevosProhibidos]);
    expect(todos.filter((r, i) => todos.indexOf(r) !== i)).toEqual([]);
  });

  it("muerde: caza un sinónimo en JSX y en un literal", () => {
    expect(conteoDe(cadenasVisibles("<th>Atendidas</th>"), "Atendidas")).toBe(1);
    expect(conteoDe(cadenasVisibles('const t = "Total Recaudo del mes";'), "Recaudo")).toBe(1);
  });

  it("no marca lo bueno: nombres vigentes, otra palabra que lo contiene y códigos internos", () => {
    expect(conteoDe(cadenasVisibles("<th>Llamadas atendidas</th>"), "Atendidas")).toBe(0);
    expect(conteoDe(cadenasVisibles('const t = "Recaudado";'), "Recaudo")).toBe(0);
    expect(conteoDe(cadenasVisibles('const k = "atendidas"; // Atendidas'), "Atendidas")).toBe(0);
  });
});
