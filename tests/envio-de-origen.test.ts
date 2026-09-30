import { describe, expect, it } from "vitest";
import { envioMasReciente, type EnvioCandidato } from "@/lib/ingesta/envio-de-origen";

/**
 * ADR 0060 punto 3 — el envío de origen de un deal que no abre la ingesta: el más reciente
 * del lead. Mismo orden que `resumirEnvios`, y el resultado no depende del orden de entrada.
 */

const e = (id: string, fecha: string | null, posicion: number | null = null): EnvioCandidato => ({
  id,
  fechaEnvio: fecha ? new Date(fecha) : null,
  posicionEnHoja: posicion,
});

describe("envioMasReciente", () => {
  it("sin envíos, nulo: nunca un origen por defecto", () => {
    expect(envioMasReciente([])).toBeNull();
  });

  it("la fecha manda, y un envío sin fecha nunca le gana a uno fechado", () => {
    const envios = [e("a", "2026-07-01T12:00:00-05:00"), e("b", null, 999), e("c", "2026-08-01T12:00:00-05:00", 1)];
    expect(envioMasReciente(envios)).toBe("c");
  });

  it("a igual fecha, o sin fecha, decide la posición en la hoja", () => {
    expect(envioMasReciente([e("a", "2026-08-01T12:00:00-05:00", 5), e("b", "2026-08-01T12:00:00-05:00", 3)])).toBe("a");
    expect(envioMasReciente([e("a", null, 2), e("b", null, 7)])).toBe("b");
  });

  it("el resultado no depende del orden en que llegan las filas", () => {
    const envios = [e("x", null), e("y", null), e("z", "2026-08-01T12:00:00-05:00"), e("w", "2026-08-01T12:00:00-05:00")];
    const esperado = envioMasReciente(envios);
    expect(envioMasReciente([...envios].reverse())).toBe(esperado);
    expect(envioMasReciente([envios[2], envios[0], envios[3], envios[1]])).toBe(esperado);
  });
});
