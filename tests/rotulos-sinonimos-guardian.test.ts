import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Contrato de métricas y datos §8 (2), ADR 0115 N4 (un nombre por concepto): el guardián del Hub
 * (`hub-vocabulario-guardian.test.ts`) caza jerga, no sinónimos. Este caza sinónimos NUEVOS en TODAS las
 * superficies (pantallas, listas, MCP, WhatsApp). El ticket 397 fijó el nombre canónico de cada concepto:
 * `VIGENTES` contiene solo esos nombres y `NUEVOS_PROHIBIDOS` reúne los rótulos retirados y otros sinónimos.
 *
 * Por concepto hay dos listas:
 *   - `VIGENTES`: el único rótulo canónico de cada concepto;
 *   - `NUEVOS_PROHIBIDOS`: sinónimos que hoy NO aparecen en ninguna superficie y no deben aparecer.
 * No se vigilan "Conversiones" (nombre de la API de Meta) ni "Reservas" (la definición de Citas lo usa en prosa):
 * son usos legítimos de otra cosa que este guardián, sin contexto, no distingue.
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
  "cita realizada": {
    vigentes: { "Realizadas": "nombre canónico" },
    nuevosProhibidos: ["Show", "Shows", "Llamadas atendidas", "Atendidas", "Asistieron", "Presentadas", "Concretadas", "Efectivas"],
  },
  "porcentaje de asistencia": {
    vigentes: { "Asistencia": "nombre canónico" },
    nuevosProhibidos: ["Porcentaje de show", "% show"],
  },
  "complemento de asistencia": {
    vigentes: { "No asistió": "nombre canónico" },
    nuevosProhibidos: ["No-show", "No show", "No shows"],
  },
  "recaudado de ventas": {
    vigentes: { "Recaudado": "nombre canónico" },
    nuevosProhibidos: ["Confirmado", "Cobrado", "Facturado", "Recaudo"],
  },
  "abonos del periodo": {
    vigentes: { "Entró a caja": "nombre canónico" },
    nuevosProhibidos: ["Caja", "Caja del día", "Ingresado", "Ingresos"],
  },
  "venta": {
    vigentes: { "Ventas": "nombre canónico", "Cupos vendidos": "nombre permitido en Hub › Hoy" },
    nuevosProhibidos: ["Cierres", "Ventas cerradas", "Ventas ganadas", "Cerradas", "Deals ganados"],
  },
  "cita creada": {
    vigentes: { "Agendadas": "nombre canónico" },
    nuevosProhibidos: ["Agendas", "Reservadas", "Bookings", "Turnos"],
  },
  "cita por fecha": {
    vigentes: { "Citas": "nombre canónico" },
    nuevosProhibidos: [],
  },
  "agenda del pixel": {
    vigentes: { "Agendas de Meta": "nombre canónico" },
    nuevosProhibidos: [],
  },
  "lead": {
    vigentes: { "Leads": "nombre canónico" },
    nuevosProhibidos: ["Prospectos", "Postulaciones"],
  },
  "envío": {
    vigentes: { "Envíos": "nombre canónico" },
    nuevosProhibidos: ["Registros"],
  },
};

/** Cadenas visibles: literales y texto de JSX. Copia mínima del extractor del guardián del Hub. */
export function cadenasVisibles(fuente: string): string[] {
  const limpio = sinComentarios(fuente);
  const literales = [...limpio.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, ""));
  const jsx = [...limpio.matchAll(/>([^<>{};"]*[A-Za-zÁ-ú][^<>{};"]*)(?=[<{])/g)].map((m) => m[1]);
  return [...literales, ...jsx].filter((t) => !/^[a-z0-9_\-:./]+$/.test(t));
}

/**
 * Nombres compuestos aprobados por Mani en el boceto `docs/bocetos/una-forma-de-metrica.html` y en
 * `docs/diseno-cifra-y-pauta.md` (Pauta los usa así en su Excel). Contienen un rótulo prohibido, pero son otro
 * concepto o la forma aprobada: "Agendas por día" es un promedio, no la cita creada. Cada frase es exacta:
 * un "Agendas" o "Registros" suelto sigue contando.
 */
const NOMBRES_APROBADOS = [
  "Agendas de Meta",
  "Agendas por día necesarias",
  "Agendas por día hábil",
  "Agendas por día",
  "Registros de pauta sin anuncio identificado",
  "Registros de pauta sin anuncio",
  "Registros de pauta",
  "Registros sin origen",
  "Registros cuyo enlace",
];

export function conteoDe(textos: string[], rotulo: string): number {
  const re = new RegExp(`(?<![A-Za-zÁ-ú0-9_-])${rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-zÁ-ú0-9_-])`);
  const sinAprobados = (texto: string) => NOMBRES_APROBADOS.filter((n) => n !== rotulo).reduce((t, n) => t.replaceAll(n, ""), texto);
  return textos.filter((texto) => re.test(sinAprobados(texto))).length;
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

  it("no marca lo bueno: nombres canónicos, otra palabra que lo contiene y códigos internos", () => {
    expect(conteoDe(cadenasVisibles("<th>Realizadas</th>"), "Realizadas")).toBe(1);
    expect(conteoDe(cadenasVisibles("<th>Agendas de Meta</th>"), "Agendas")).toBe(0);
    expect(conteoDe(cadenasVisibles('const t = "Recaudado";'), "Recaudo")).toBe(0);
    expect(conteoDe(cadenasVisibles('const k = "atendidas"; // Atendidas'), "Atendidas")).toBe(0);
  });
});
