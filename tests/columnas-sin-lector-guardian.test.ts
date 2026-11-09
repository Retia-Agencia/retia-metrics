import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Contrato de métricas y datos §8 (8), ADR 0077 y N7 ("reemplazar es borrar"): una columna que nadie lee es
 * deuda que se ve igual que una viva (F3-06, F3-13, F3-14: 0 filas pobladas y 0 lectores, y siguen en el
 * esquema). Este guardián mide los muertos NUEVOS: una columna de las tablas de hechos sin lector fuera de
 * `lib/db/schema.ts` debe estar en la lista nombrada de abajo, con el hallazgo de F3 que la retira.
 *
 * Alcance (decisión de Mani, 7-nov: hechos primero): las tablas de `TABLAS` (hechos, identidad y las que F3
 * marcó con muertos). El resto de las tablas es un segundo pase si un hijo de F7 las toca.
 *
 * Qué es un lector: el código de `lib/`, `app/`, `components/` y `scripts/` (sin `tests/`, sin comentarios,
 * sin `scripts/seed*`: sembrar escribe, no lee) que contenga `tabla.campo` (consulta de drizzle) o, si el
 * nombre del campo no es genérico, `.campo` (lectura de una fila). Una escritura (`campo:` en un insert o
 * un set) no es lectura.
 * Límite honesto: para un nombre genérico (`estado`, `pais`, `raw`...) solo vale la forma `tabla.campo`; una
 * lectura por fila (`lead.pais`) no se ve y obligaría a una excepción. Y un lector que solo escribe a un campo
 * leyéndolo en una cadena dinámica no se ve. Es una alarma para lo nuevo, no una prueba de que algo esté muerto.
 */
const RAIZ = process.cwd();

/** Constante de drizzle de cada tabla bajo vigilancia. */
const TABLAS = [
  "submissions", "leads", "leadContactos", "deals", "dealEtapaHistorial", "calls", "abonos", "gastoPauta",
  "pautaObjetos", "cohorts", "users", "programs", "syncRuns", "canales", "changeLog", "sources",
] as const;

/** Nombres que aparecen en casi cualquier objeto: ahí `.campo` no prueba nada, solo `tabla.campo`. */
const GENERICOS = new Set([
  "id", "nombre", "estado", "raw", "activo", "notas", "pais", "ciudad", "cargo", "empresa", "origen", "email", "tipo",
  "moneda", "monto", "nota", "fecha", "token", "area", "canal", "codigo", "slug", "titulo", "descripcion", "orden",
  "valor", "rol", "telefono", "cohortId", "programId", "dealId", "leadId", "closerId", "closerUserId", "ownerUserId", "userId", "creadoPor", "createdAt", "updatedAt", "motivo", "version", "razon", "porcentaje",
]);

/** `tabla.campo` → hallazgo de F3 o ticket que lo retira. Una columna aquí NO tiene lector hoy. */
const SIN_LECTOR_CONOCIDOS: Record<string, string> = {
  "calls.cohortId": "F3-04: la cohorte de un hecho es la de su deal; eliminar columna e índice",
  "calls.closerId": "F3-05 / 401 M10: 0 pobladas; el closer de una llamada es solo closer_user_id",
  "calls.motivoPerdida": "401 M10: texto de las filas viejas de Sheets; el motivo es motivo_id",
  "canales.id": "F3-16: la pantalla es un redirect y la regla vive en resolverCanal; eliminar la tabla",
  "canales.nombre": "F3-16: eliminar la tabla",
  "canales.activo": "F3-16: eliminar la tabla",
  "leads.estado": "F3-06: 100 % cola_setteo, 0 lectores",
  "leads.cohortId": "F3-06: 100 % nulo, 0 lectores",
  "leads.cargo": "F3-06: 0 filas pobladas, 0 lectores",
  "leads.empresa": "F3-06: 0 filas pobladas, 0 lectores",
  "leads.ciudad": "F3-06 / 401 M9: 0 filas pobladas; se retiró su lectura (ficha, MCP, CSV)",
  "leads.pais": "401 M9 (decisión de Mani, 9-nov): vacío en 3.760 leads; se retiró su lectura (Meta CAPI, ficha, MCP, CSV)",
  "leads.ingresoDeclarado": "F3-06: 0 filas pobladas, 0 lectores",
  "leads.urgencia": "F3-06: 0 filas pobladas, 0 lectores",
  "leads.porQueAplico": "F3-06: 0 filas pobladas, 0 lectores",
  "leads.motivoDescarte": "F3-06: 0 filas pobladas, 0 lectores",
  "leads.raw": "F3-06: 0 filas pobladas, 0 lectores",
  "submissions.versionPuntaje": "F3-13: 0 pobladas; eliminar con su código",
  "submissions.estadoHoja": "401 M11: copia de calificacion; ya no se escribe ni se lee",
  "programs.recordPersonasPorDiaHabil": "F3-14: solo la lee scripts/seed-datos.ts; eliminar",
  "abonos.origen": "385 F7: sin lector el 7-nov y no está en F3; decidir si se elimina o se lee",
  "cohorts.notas": "385 F7: sin lector el 7-nov y no está en F3; decidir si se elimina o se lee",
  "deals.creadoPor": "385 F7: sin lector el 7-nov y no está en F3 (el rastro vive en change_log); decidir",
};

/** Auditoría de fila (cuándo se creó o tocó): se escribe siempre y nadie la mide; no es deuda de métricas. */
const AUDITORIA_DE_FILA = new Set(["createdAt", "updatedAt"]);

export type Columna = { tabla: string; campo: string };

/** Columnas de una tabla de drizzle: los campos a 4 espacios de sangría dentro de su `pgTable`. */
export function columnasDe(esquema: string, constante: string): string[] {
  const lineas = esquema.split("\n");
  const inicio = lineas.findIndex((l) => new RegExp(`^export const ${constante} = pgTable\\(`).test(l));
  if (inicio < 0) return [];
  const campos: string[] = [];
  for (let i = inicio + 1; i < lineas.length; i++) {
    if (/^  \},?\s*$/.test(lineas[i]) || /^\}\);?\s*$/.test(lineas[i])) break;
    const m = lineas[i].match(/^ {4}([A-Za-z][A-Za-z0-9]*):\s*[a-zA-Z]+\(/);
    if (m) campos.push(m[1]);
  }
  return campos;
}

export function tieneLector(campo: string, tabla: string, codigo: string): boolean {
  if (new RegExp(`(?<![\\w$])${tabla}\\.${campo}(?![\\w$])`).test(codigo)) return true;
  if (GENERICOS.has(campo)) return false;
  return new RegExp(`\\.${campo}(?![\\w$])`).test(codigo);
}

function codigoDeLectura(): string {
  return ["lib", "app", "components", "scripts"].flatMap((c) => archivos(path.join(RAIZ, c)))
    .filter((f) => {
      const rel = path.relative(RAIZ, f).split(path.sep).join("/");
      return rel !== "lib/db/schema.ts" && !/^scripts\/seed/.test(rel);
    })
    .map((f) => sinComentarios(fs.readFileSync(f, "utf8")))
    .join("\n");
}

function sinLector(): string[] {
  const esquema = fs.readFileSync(path.join(RAIZ, "lib/db/schema.ts"), "utf8");
  const codigo = codigoDeLectura();
  return TABLAS.flatMap((tabla) => columnasDe(esquema, tabla).filter((campo) => !AUDITORIA_DE_FILA.has(campo) && !tieneLector(campo, tabla, codigo)).map((campo) => `${tabla}.${campo}`));
}

describe("guardián: una columna de hechos tiene algún lector (ADR 0077, N7)", () => {
  const huerfanas = sinLector().sort();

  it("el esquema se lee: cada tabla vigilada tiene columnas", () => {
    const esquema = fs.readFileSync(path.join(RAIZ, "lib/db/schema.ts"), "utf8");
    expect(TABLAS.filter((t) => columnasDe(esquema, t).length === 0)).toEqual([]);
  });

  it("ninguna columna nueva de hechos nace sin lector", () => {
    expect(huerfanas.filter((c) => !(c in SIN_LECTOR_CONOCIDOS))).toEqual([]);
  });

  it("sin excepciones zombi: cada columna nombrada sigue sin lector", () => {
    expect(Object.keys(SIN_LECTOR_CONOCIDOS).filter((c) => !huerfanas.includes(c))).toEqual([]);
  });

  it("muerde: caza la columna sin lector y la lee en forma de consulta o de fila", () => {
    const esquema = [
      "export const leads = pgTable(",
      '  "leads",',
      "  {",
      '    id: uuid("id").primaryKey(),',
      '    cargo: text("cargo"),',
      '    urgencia: text("urgencia"),',
      '    versionPuntaje: integer("version_puntaje"),',
      "  },",
      "  (t) => [],",
      ");",
    ].join("\n");
    expect(columnasDe(esquema, "leads")).toEqual(["id", "cargo", "urgencia", "versionPuntaje"]);
    expect(tieneLector("urgencia", "leads", "const x = fila.otra;")).toBe(false);
    expect(tieneLector("urgencia", "leads", "select({ u: leads.urgencia })")).toBe(true);
    expect(tieneLector("versionPuntaje", "leads", "return fila.versionPuntaje;")).toBe(true);
  });

  it("no marca lo bueno: un nombre genérico exige la forma de consulta, y escribir no es leer", () => {
    expect(tieneLector("cargo", "leads", "const c = persona.cargo;")).toBe(false);
    expect(tieneLector("cargo", "leads", "where(eq(leads.cargo, 'x'))")).toBe(true);
    expect(tieneLector("urgencia", "leads", "insert().values({ urgencia: 'alta' })")).toBe(false);
  });
});
