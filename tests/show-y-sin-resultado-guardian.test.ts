import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];
const DUENOS = new Set([
  "lib/deals/resultados-de-llamada.ts",
  "lib/queries/metricas-filtros.ts",
]);

const EXCEPCIONES: Record<string, string> = {
  "app/(app)/p/[programa]/deals/[id]/acciones.ts": "Valida que no exista otra cita activa antes de escribir una nueva.",
  "app/(app)/p/[programa]/hub/lista/page.tsx": "Presenta el filtro de resultado ya calculado por la lista del Hub.",
  "components/dashboard/hoy/citas.tsx": "deuda: reescribe el predicado, ver informe",
  "components/deals/ficha/acciones-de-llamada.tsx": "Decide qué acciones de edición muestra para el estado actual.",
  "components/deals/ficha/ficha-llamadas.tsx": "Presenta acciones y avisos operativos según el estado de la llamada.",
  "components/deals/ficha/ficha-transicion.tsx": "Elige la cita activa para ejecutar una transición del deal.",
  "components/deals/responder-pregunta.tsx": "Presenta la respuesta operativa elegida para una llamada.",
  "lib/calendly/eventos-de-cita.ts": "Reconcilia y escribe los estados que llegan desde Calendly.",
  "lib/calendly/reconciliar.ts": "Busca citas activas para emparejar eventos de Calendly.",
  "lib/calendly/una-cita-activa.ts": "Garantiza que Calendly deje una sola cita activa.",
  "lib/deals/anotar.ts": "Busca la cita activa que una anotación operativa puede completar.",
  "lib/deals/estado-de-llamada.ts": "Selecciona la cita activa para mostrar y editar su estado.",
  "lib/deals/handoff.ts": "Impide transferir un deal que todavía tiene una cita activa.",
  "lib/deals/llamadas.ts": "Valida y escribe correcciones de resultado; no calcula métricas.",
  "lib/deals/mover-etapa.ts": "Usa el estado pendiente para transiciones y delega ocurrió a ocurrio().",
  "lib/ingesta/procesar-sobre.ts": "Empareja una cita activa durante la escritura de la ingesta.",
  "lib/migracion/consolidar.ts": "Migración histórica que traduce estados de origen.",
  "lib/migracion/extraer-llamadas.ts": "Migración histórica que traduce resultados de las hojas.",
  "lib/queries/dashboard.ts": "deuda: reescribe el predicado, ver informe",
  "lib/queries/ficha-deal.ts": "Proyecta si el deal tiene una cita activa; no calcula estas métricas.",
  "lib/queries/inbox-sin-dueno.ts": "Busca citas activas para la bandeja operativa sin dueño.",
  "lib/queries/inbox.ts": "Busca citas activas para las bandejas operativas.",
  "lib/queries/kanban.ts": "Proyecta la cita activa para las acciones del kanban.",
  "lib/queries/metricas-con-filas.ts": "Traduce el filtro de lista a ocurrioSql() o noAsistioSql().",
  "lib/queries/proyeccion-roas.ts": "deuda: reescribe el predicado, ver informe",
  "lib/queries/tasas-del-grupo.ts": "deuda: reescribe el predicado, ver informe",
  "scripts/seed-local.ts": "Semilla local: asigna y describe resultados sintéticos.",
};

export function infraccionesDeShowYSinResultado(fuente: string, ruta: string): string[] {
  if (DUENOS.has(ruta)) return [];
  const codigo = sinComentarios(fuente);
  const infracciones: string[] = [];
  const literal = "(?:show|no_show|agendada)";
  const comparaciones = [
    new RegExp(`\\b(?:[A-Za-z_$][\\w$]*\\.)?resultado\\s*(?:={2,3}|!={1,2})\\s*["']${literal}["']`),
    new RegExp(`["']${literal}["']\\s*(?:={2,3}|!={1,2})\\s*\\b(?:[A-Za-z_$][\\w$]*\\.)?resultado\\b`),
    new RegExp(`\\b(?:eq|ne)\\(\\s*(?:calls\\.)?resultado\\s*,\\s*["']${literal}["']`),
    new RegExp(`\\binArray\\(\\s*calls\\.resultado\\s*,[\\s\\S]{0,200}?["']${literal}["']`),
    new RegExp(`\\bresultado\\s*(?:=|<>|!=)\\s*['"]${literal}['"]`, "i"),
  ];
  if (comparaciones.some((patron) => patron.test(codigo))) infracciones.push("compara resultado con un literal del concepto");

  const relojSuelto = [
    /\b(?:fecha_agenda|fechaAgenda)\b\s*(?:<=?|>=?)\s*(?:new Date\(\)|now\(\))/i,
    /(?:new Date\(\)|now\(\))\s*(?:<=?|>=?)\s*\b(?:fecha_agenda|fechaAgenda)\b/i,
  ];
  if (relojSuelto.some((patron) => patron.test(codigo))) infracciones.push("compara fecha de agenda con el reloj suelto");
  return infracciones;
}

describe("guardián N1: show y cita sin resultado se deciden en sus módulos dueños", () => {
  it("fuera de los dueños no se reescriben los predicados", () => {
    const encontradas = CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)))
      .map((archivo) => {
        const ruta = relative(RAIZ, archivo);
        return { ruta, infracciones: infraccionesDeShowYSinResultado(readFileSync(archivo, "utf8"), ruta) };
      })
      .filter(({ infracciones }) => infracciones.length > 0);

    for (const [ruta, razon] of Object.entries(EXCEPCIONES)) {
      expect(encontradas.find((hallazgo) => hallazgo.ruta === ruta), razon).toBeDefined();
    }
    expect(encontradas.filter(({ ruta }) => !(ruta in EXCEPCIONES))).toEqual([]);
  });

  it("muerde una comparación literal y permite llamar al dueño", () => {
    expect(infraccionesDeShowYSinResultado('const atendida = resultado === "show"', "lib/x.ts"))
      .toContain("compara resultado con un literal del concepto");
    expect(infraccionesDeShowYSinResultado("const atendida = ocurrio(resultado)", "lib/x.ts"))
      .toEqual([]);
  });
});
