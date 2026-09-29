import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Ticket 096 — nadie crea una llamada de Calendly por fuera de sus dos escritores (ADR 0049).
 *
 * Una llamada colgada del deal equivocado se ve igual que una bien colgada y no lanza ningun
 * error. Por eso la decision vive en el emparejador puro y la escritura en dos lugares que lo
 * respetan:
 *  - `lib/calendly/colgar-llamada.ts`: la cita que llega de Calendly (A5) y la suelta que un
 *    closer asigna a mano;
 *  - `lib/ingesta/regla-de-deals.ts`: la cita del envio "Con Calendly" (052), que ya sabe
 *    de que lead es porque el lead lleno el formulario.
 *
 * Se caza la marca de una llamada de Calendly: `origen: "calendly"` y la huella
 * `calendly:<uuid>` escrita a mano (la arma `huellaDeCita`). Los comentarios no cuentan.
 */
const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const DIRECTORIOS = ["lib", "app", "components", "scripts"];
const ESCRITORES = new Set([
  path.join("lib", "calendly", "colgar-llamada.ts"),
  path.join("lib", "ingesta", "regla-de-deals.ts"),
]);

const MARCAS = [/origen\s*:\s*["'`]calendly["'`]/, /["'`]calendly:/];

function escribeLlamadaDeCalendly(fuente: string): boolean {
  const texto = sinComentarios(fuente);
  return MARCAS.some((m) => m.test(texto));
}

describe("guardian: las llamadas de Calendly solo las escriben sus dos escritores", () => {
  it("ningun otro archivo marca una llamada como de Calendly", () => {
    const culpables = DIRECTORIOS.flatMap((d) => archivos(path.join(RAIZ, d)))
      .map((f) => path.relative(RAIZ, f))
      .filter((f) => !ESCRITORES.has(f))
      .filter((f) => escribeLlamadaDeCalendly(fs.readFileSync(path.join(RAIZ, f), "utf8")));
    expect(culpables).toEqual([]);
  });

  it("los escritores autorizados siguen marcando sus llamadas (si no, el guardian no vigila nada)", () => {
    for (const f of ESCRITORES) {
      expect(escribeLlamadaDeCalendly(fs.readFileSync(path.join(RAIZ, f), "utf8"))).toBe(true);
    }
  });

  it("muerde: caza un insert a mano y una huella armada a mano", () => {
    expect(escribeLlamadaDeCalendly(`db.insert(calls).values({ dealId, origen: "calendly" });`)).toBe(true);
    expect(escribeLlamadaDeCalendly("const h = `calendly:${uuid}`;")).toBe(true);
  });

  it("no muerde la solucion ni un comentario", () => {
    expect(escribeLlamadaDeCalendly(`await registrarLlamadaDeCalendly(db, programId, cita);`)).toBe(false);
    expect(escribeLlamadaDeCalendly(`// origen: "calendly" lo pone el escritor`)).toBe(false);
    expect(escribeLlamadaDeCalendly(`.where(eq(calls.origen, "calendly"))`)).toBe(false);
  });
});
