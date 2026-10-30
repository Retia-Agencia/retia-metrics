import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

/**
 * N9 del ADR 0115 (ticket 362): terminado es con evidencia. El estado de cada fila de
 * `docs/tasks/README.md` coincide con el `status:` del archivo del ticket, y un ticket `done`
 * no tiene casillas `[ ]` en su "Done cuando". El 30-oct el 350 estaba `done` con sus cinco
 * casillas vacías y 143, 152, 156 y 157 decían `done` en el tracker y `en curso` en su archivo.
 *
 * Los desajustes de hoy NO se corrigen aquí: el tracker lo pone al día Mani en el checkpoint.
 * Quedan como excepciones nombradas y fechadas; una que ya no hace falta también falla, para que
 * la lista solo se achique.
 */
const RAIZ_TAREAS = fileURLToPath(new URL("../docs/tasks/", import.meta.url));

const ESTADOS = ["todo", "en curso", "en main", "done", "bloqueado", "reemplazado", "descartado", "por grill", "idea"] as const;
type Estado = (typeof ESTADOS)[number];
const CERRADOS: readonly Estado[] = ["done", "reemplazado", "descartado"];

/** Lo que el archivo escribe distinto para el mismo estado; nada más se traduce. */
const SINONIMOS: Record<string, Estado> = {
  in_progress: "en curso",
  "in-progress": "en curso",
  doing: "en curso",
  "por-grill": "por grill",
};

type Regla = "estado" | "casilla" | "done-cuando";

/** Clave `<id>:<regla>`. Fecha y razón, siempre. */
const EXCEPCIONES: Record<string, string> = {
  "143:estado": "30-oct (K-05): done en el tracker, in_progress en el archivo; lo pone al día Mani en el checkpoint",
  "152:estado": "30-oct (K-05): done en el tracker, en curso en el archivo; lo pone al día Mani en el checkpoint",
  "156:estado": "30-oct (K-05): done en el tracker, en curso en el archivo; lo pone al día Mani en el checkpoint",
  "157:estado": "30-oct (K-05): done en el tracker, in_progress en el archivo; lo pone al día Mani en el checkpoint",
  "350:done-cuando": "30-oct (K-05): done con sus cinco casillas vacías; su enmienda del 30-oct lo devuelve a `en main`",
  "258:estado": "30-oct: el tracker dice `v1 done` y el archivo `en curso`, con un comentario en el `status:`",
  "281:estado": "30-oct: el tracker dice `en main` y el archivo `todo`",
  "314:estado": "30-oct: el tracker dice `en producción` (no es un estado) y el archivo `doing`",
  "322:estado": "30-oct: el tracker dice `en curso` y el archivo `todo`",
  "328:estado": "30-oct: el tracker dice `en curso` y el archivo `todo`",
  "308:estado": "30-oct: el tracker dice `en curso` y el archivo `todo`",
};

export /**
 * 30-oct: tickets cerrados ANTES de la N9 con casillas vacías en su "Done cuando" (la costumbre era marcar el
 * tracker y no el archivo). Lista congelada: no crece. Mani decide en el checkpoint si se marcan con su evidencia
 * o se reabren; cada uno que se arregle sale de aquí (si sobra, el test falla).
 */
const CERRADOS_ANTES_DE_N9_SIN_CASILLAS = new Set([
  "007", "016", "036", "037", "038", "039", "040", "041", "043", "044", "045", "046", "047", "048",
  "049", "050", "051", "061", "062", "065", "066", "068", "069", "070", "071", "072", "074", "076",
  "077", "079", "086", "088", "092", "094", "098", "103", "108", "110", "112", "113", "117", "119",
  "122", "133", "169", "207", "209", "210", "211", "215", "216", "217", "218", "219", "220", "221",
  "222", "223", "225", "226", "227", "228", "229", "230", "231", "234", "235", "238", "239", "240",
  "241", "244", "245", "246", "255", "259", "260", "264", "265", "269", "310",
]);

interface FilaDelTracker {
  id: string;
  casilla: string;
  archivo: string;
  estado: string;
}

export interface Desajuste {
  id: string;
  regla: Regla;
  detalle: string;
}

/** Las filas del tracker que enlazan al archivo de un ticket. */
export function filasDelTracker(texto: string): FilaDelTracker[] {
  const filas: FilaDelTracker[] = [];
  for (const linea of texto.split("\n")) {
    const celdas = linea.split("|").map((celda) => celda.trim());
    // | ✓ | # | Ticket | Depende de | Estado |
    if (celdas.length < 7 || !/^\[.\]$/.test(celdas[1])) continue;
    const enlace = /\]\(\.\/([^)]+\.md)\)/.exec(celdas[3]);
    if (!enlace) continue;
    filas.push({ casilla: celdas[1], id: celdas[2], archivo: enlace[1], estado: celdas[5] });
  }
  return filas;
}

export function normalizarStatus(status: string): string {
  const limpio = status.replace(/#.*$/, "").trim().toLowerCase();
  return SINONIMOS[limpio] ?? limpio;
}

/** El estado con que empieza la celda ("done · 29-oct · …", "reemplazado por el 235"), sin negritas; null si no empieza con uno. */
export function estadoDeLaCelda(celda: string): Estado | null {
  const inicio = celda.replace(/\*/g, "").trim().toLowerCase();
  const encontrados = ESTADOS.filter((estado) => inicio === estado || new RegExp(`^${estado}\\b`).test(inicio));
  return encontrados.sort((a, b) => b.length - a.length)[0] ?? null;
}

export function statusDelArchivo(texto: string): string | null {
  const m = /^status:\s*(.*)$/m.exec(texto);
  return m ? normalizarStatus(m[1]) : null;
}

/** Las casillas vacías de la sección "Done cuando", hasta el siguiente encabezado. */
export function casillasVaciasDelDoneCuando(texto: string): number {
  let dentro = false;
  let vacias = 0;
  for (const linea of texto.split("\n")) {
    if (/^#{1,6}\s/.test(linea)) {
      dentro = /done cuando/i.test(linea);
      continue;
    }
    if (dentro && /^\s*[-*]\s+\[ \]/.test(linea)) vacias++;
  }
  return vacias;
}

export function desajustes(fila: FilaDelTracker, textoDelArchivo: string | null): Desajuste[] {
  if (textoDelArchivo === null) return [{ id: fila.id, regla: "estado", detalle: `no existe ${fila.archivo}` }];
  const status = statusDelArchivo(textoDelArchivo);
  const enTracker = estadoDeLaCelda(fila.estado);
  const encontrados: Desajuste[] = [];
  if (enTracker !== status) {
    encontrados.push({ id: fila.id, regla: "estado", detalle: `tracker "${enTracker ?? fila.estado.slice(0, 30)}", archivo "${status}"` });
  }
  // `[-]` también cierra: el tracker lo usa para lo descartado.
  const marcada = fila.casilla !== "[ ]";
  if (marcada !== (enTracker !== null && CERRADOS.includes(enTracker))) {
    encontrados.push({ id: fila.id, regla: "casilla", detalle: `casilla ${fila.casilla} con estado "${enTracker}"` });
  }
  if (status === "done") {
    const vacias = casillasVaciasDelDoneCuando(textoDelArchivo);
    if (vacias > 0) encontrados.push({ id: fila.id, regla: "done-cuando", detalle: `${vacias} casillas vacías` });
  }
  return encontrados;
}

const ARCHIVO_DONE = "---\nstatus: done\n---\n# X\n## Done cuando\n- [x] uno\n- [x] dos\n## Después\n- [ ] no cuenta\n";

describe("tracker coherente: las reglas (mordidas en los dos sentidos)", () => {
  const fila = (estado: string, casilla = "[x]"): FilaDelTracker => ({ id: "999", casilla, archivo: "999-x.md", estado });

  it("una fila al día no da desajustes", () => {
    expect(desajustes(fila("done · 30-oct · `abc`"), ARCHIVO_DONE)).toEqual([]);
    expect(desajustes(fila("reemplazado por el 235 (13-oct)"), "status: reemplazado\n")).toEqual([]);
    expect(desajustes(fila("en curso · 30-oct", "[ ]"), "status: in_progress\n")).toEqual([]);
  });

  it("una fila desfasada falla: done en el tracker, en curso en el archivo", () => {
    expect(desajustes(fila("done · 2-oct"), "status: en curso\n").map((d) => d.regla)).toEqual(["estado"]);
  });

  it("una casilla que no cuadra con su estado falla", () => {
    expect(desajustes(fila("todo", "[x]"), "status: todo\n").map((d) => d.regla)).toEqual(["casilla"]);
    expect(desajustes(fila("done · 30-oct", "[ ]"), ARCHIVO_DONE).map((d) => d.regla)).toEqual(["casilla"]);
  });

  it("un done con una casilla vacía en su Done cuando falla; fuera de esa sección no cuenta", () => {
    const conVacia = ARCHIVO_DONE.replace("- [x] dos", "- [ ] dos");
    expect(desajustes(fila("done · 30-oct"), conVacia)).toEqual([{ id: "999", regla: "done-cuando", detalle: "1 casillas vacías" }]);
  });

  it("un ticket que no es done puede tener casillas vacías", () => {
    expect(desajustes(fila("en main", "[ ]"), "status: en main\n## Done cuando\n- [ ] falta\n")).toEqual([]);
  });

  it("lee las filas reales del formato del tracker", () => {
    const texto = "| ✓ | # | Ticket | Depende de | Estado |\n|---|---|---|---|---|\n"
      + "| [x] | 350 | [ROAS](./350-roas.md) | 123 | done · 29-oct |\n"
      + "| [x] | · | Plantilla sin archivo | · | done · 1-oct |\n";
    expect(filasDelTracker(texto)).toEqual([{ casilla: "[x]", id: "350", archivo: "350-roas.md", estado: "done · 29-oct" }]);
  });
});

describe("tracker coherente: docs/tasks/README.md contra cada archivo (N9)", () => {
  const tracker = fs.readFileSync(path.join(RAIZ_TAREAS, "README.md"), "utf8");
  const leer = (archivo: string) => {
    const ruta = path.join(RAIZ_TAREAS, archivo);
    return fs.existsSync(ruta) ? fs.readFileSync(ruta, "utf8") : null;
  };
  const todos = filasDelTracker(tracker).flatMap((fila) => desajustes(fila, leer(fila.archivo)));
  const claves = new Set(todos.map((d) => `${d.id}:${d.regla}`));
  const exceptuado = (d: Desajuste) => `${d.id}:${d.regla}` in EXCEPCIONES
    || (d.regla === "done-cuando" && CERRADOS_ANTES_DE_N9_SIN_CASILLAS.has(d.id));

  it("encuentra filas que revisar", () => {
    expect(filasDelTracker(tracker).length).toBeGreaterThan(300);
  });

  it("el tracker y los archivos dicen lo mismo, salvo las excepciones nombradas", () => {
    const sinExcepcion = todos.filter((d) => !exceptuado(d));
    expect(sinExcepcion).toEqual([]);
  });

  it("ninguna excepción sobra", () => {
    expect(Object.keys(EXCEPCIONES).filter((clave) => !claves.has(clave))).toEqual([]);
    expect([...CERRADOS_ANTES_DE_N9_SIN_CASILLAS].filter((id) => !claves.has(`${id}:done-cuando`))).toEqual([]);
  });
});
