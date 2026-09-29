import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * ADR 0059 — lo historico lo escribe SOLO la migracion.
 *
 * `abrirDealHistorico` abre un deal en cualquier etapa sin pasar por `queLeFalta`, y los
 * abonos y llamadas historicos no mueven nada ni pasan la reja del dueño. Es justo lo que
 * la migracion necesita y justo lo que una pantalla NUNCA debe poder hacer: un deal en
 * Completo sin abono, o un abono que no mueve el deal, se ven creibles y no lanzan ningun
 * error.
 *
 * Se caza el uso de los tres escritores y la marca de lo migrado (`huellaMigracion:`) fuera
 * de donde viven y del importador (`lib/migracion/`, ticket 078 paso 4).
 */
const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const DIRECTORIOS = ["lib", "app", "components", "scripts"];
const AUTORIZADOS = new Set([
  path.join("lib", "deals", "mover-etapa.ts"),
  path.join("lib", "deals", "historico.ts"),
  // Donde se DEFINE la columna (`huellaMigracion: text(...)`), no donde se escribe.
  path.join("lib", "db", "schema.ts"),
]);
const IMPORTADOR = path.join("lib", "migracion") + path.sep;

// Cualquier MENCION de un escritor, no solo la llamada: un import con alias
// (`abrirDealHistorico as abrir`) o pasarlo como callback se saltaria un patron de llamada.
const MARCAS = [
  /\b(abrirDealHistorico|registrarAbonoHistorico|registrarLlamadaHistorica)\b/,
  /\bhuellaMigracion\s*:/,
];

function escribeLoHistorico(fuente: string): boolean {
  const texto = sinComentarios(fuente);
  return MARCAS.some((m) => m.test(texto));
}

function autorizado(relativo: string): boolean {
  return AUTORIZADOS.has(relativo) || relativo.startsWith(IMPORTADOR);
}

describe("guardian: lo historico solo lo escribe la migracion (ADR 0059)", () => {
  it("ningun otro archivo usa los escritores historicos ni marca una fila como migrada", () => {
    const culpables = DIRECTORIOS.flatMap((d) => archivos(path.join(RAIZ, d)))
      .map((f) => path.relative(RAIZ, f))
      .filter((f) => !autorizado(f))
      .filter((f) => escribeLoHistorico(fs.readFileSync(path.join(RAIZ, f), "utf8")));
    expect(culpables).toEqual([]);
  });

  it("muerde: caza la llamada al escritor y la marca escrita a mano", () => {
    expect(escribeLoHistorico(`await abrirDealHistorico(db, alta);`)).toBe(true);
    expect(escribeLoHistorico(`await registrarAbonoHistorico (db, a);`)).toBe(true);
    expect(escribeLoHistorico(`db.insert(deals).values({ huellaMigracion: "x" })`)).toBe(true);
    // Hallazgo de la revision (Codex, 29-sep): el alias y el callback tambien cuentan.
    expect(escribeLoHistorico(`import { abrirDealHistorico as abrir } from "@/lib/deals/historico";`)).toBe(true);
    expect(escribeLoHistorico(`filas.map(registrarLlamadaHistorica)`)).toBe(true);
  });

  it("no marca los comentarios ni la lectura de la columna", () => {
    expect(escribeLoHistorico(`// abrirDealHistorico(db, alta)`)).toBe(false);
    expect(escribeLoHistorico(`eq(deals.huellaMigracion, h)`)).toBe(false);
  });

  it("el importador y los dos modulos del escritor estan autorizados, una pantalla no", () => {
    expect(autorizado(path.join("lib", "migracion", "importar.ts"))).toBe(true);
    expect(autorizado(path.join("lib", "deals", "historico.ts"))).toBe(true);
    expect(autorizado(path.join("app", "p", "[slug]", "deals", "acciones.ts"))).toBe(false);
  });
});
