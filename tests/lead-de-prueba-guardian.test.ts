import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { sinComentarios } from "./helpers/codigo-fuente";

/**
 * Desde la migracion 0119 (ADR 0121) la base rechaza un lead de formulario sin fecha. Un test que
 * siembra `insert(leads)` sin fecha revienta con el CHECK, o peor, se vuelve a escribir a medias.
 * Todo `insert(leads).values(...)` de `tests/` lleva `fechaPrimeraAplicacion` o `entrada: "crm"`
 * en cada objeto, o pasa por `crearLeadDePrueba`. Una excepcion se agrega aqui solo si el test
 * prueba justamente el rechazo del CHECK, con su razon.
 */
const RAIZ = fileURLToPath(new URL("./", import.meta.url));
const EXCEPCIONES: Record<string, string> = {
  "lead-formulario-con-fecha.test.ts": "Prueba justamente que la base rechaza un lead de formulario sin fecha.",
  "lead-de-prueba-guardian.test.ts": "Sus propias cadenas de muestra contienen inserts sin fecha para morder el guardian.",
  "lead-nace-con-fecha.test.ts": "Incluye el caso que prueba el rechazo del CHECK (insert de formulario sin fecha).",
  "migracion-0058.test.ts": "SQL crudo contra el esquema de la migracion 0058, anterior al CHECK.",
};

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []);
}

/** Cuerpos de cada `insert(leads).values(` hasta su parentesis de cierre. */
function insercionesDeLeads(fuente: string): string[] {
  const codigo = sinComentarios(fuente);
  const salida: string[] = [];
  for (const m of codigo.matchAll(/insert\((?:schema\.)?leads\)\s*\.values\(/g)) {
    let prof = 1;
    let i = m.index! + m[0].length;
    const ini = i;
    for (; i < codigo.length && prof > 0; i++) {
      if (codigo[i] === "(") prof++;
      else if (codigo[i] === ")") prof--;
    }
    salida.push(codigo.slice(ini, i - 1));
  }
  return salida;
}

function sinFecha(cuerpo: string): boolean {
  return !/fechaPrimeraAplicacion|entrada:\s*"crm"|FECHA_LEAD_DE_PRUEBA/.test(cuerpo);
}

describe("guardian: sembrar leads en tests respeta el CHECK de la 0119", () => {
  it("ningun insert(leads) de tests/ queda sin fecha", () => {
    const malos = archivos(RAIZ)
      .filter((f) => !(path.basename(f) in EXCEPCIONES))
      .filter((f) => insercionesDeLeads(fs.readFileSync(f, "utf8")).some(sinFecha))
      .map((f) => path.relative(RAIZ, f));
    expect(malos).toEqual([]);
  });

  it("las excepciones siguen siendo necesarias", () => {
    const obsoletas = Object.keys(EXCEPCIONES).filter((n) => {
      const f = archivos(RAIZ).find((a) => path.basename(a) === n);
      return !f || !/insert\((?:schema\.)?leads\)|insert into leads/.test(sinComentarios(fs.readFileSync(f, "utf8")));
    });
    expect(obsoletas).toEqual([]);
  });

  it("muerde en los dos sentidos", () => {
    expect(insercionesDeLeads("db.insert(leads).values({ programId, emailNormalizado: 'a' })").some(sinFecha)).toBe(true);
    expect(insercionesDeLeads("db.insert(leads).values({ fechaPrimeraAplicacion: F, programId })").some(sinFecha)).toBe(false);
    expect(insercionesDeLeads('db.insert(leads).values({ entrada: "crm", programId })').some(sinFecha)).toBe(false);
  });
});
