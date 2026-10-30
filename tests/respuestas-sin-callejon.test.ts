import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Una respuesta de la pregunta de la etapa nunca termina en una URL que nadie lee.
 *
 * 🩸 30-oct: tras el 219, "No asistió o canceló" y "Se movió" hacían `router.push(ficha?accion=…)`
 * y ninguna pantalla leía `?accion=`: arrastrar Agendado a Re-agenda no abría nada, sin error.
 * Cada respuesta abre su pop-up donde se toma; el guardián caza el patrón de vuelta.
 */
function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

describe("respuestas sin callejón", () => {
  it("ningún código arma un enlace con ?accion=", () => {
    const culpables = ["app", "components", "lib"]
      .flatMap(fuentes)
      .filter((ruta) => /[?&]accion=/.test(readFileSync(ruta, "utf8")));
    expect(culpables).toEqual([]);
  });

  it("el hook de respuestas abre el diálogo de la cita para fallida y reprogramar", () => {
    const fuente = readFileSync("components/deals/responder-pregunta.tsx", "utf8");
    expect(fuente).toContain("DialogoFallida");
    expect(fuente).toContain("DialogoReagendar");
    expect(fuente).not.toMatch(/router\.push/);
  });
});
