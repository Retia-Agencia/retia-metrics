import { describe, expect, it } from "vitest";
import { fecha, monto } from "@/lib/format";

/**
 * Ticket 005 — la moneda va SIEMPRE al lado del numero y nunca se convierte
 * (restriccion dura de AGENTS.md: hay caja en USD y pauta en COP, sin TRM historica
 * unica). La pantalla recibe filas `{ moneda, total }` de la base, asi que el
 * formateador tiene que despachar por ese texto, no por un tipo del codigo.
 */
describe("monto con su moneda", () => {
  it("formatea USD y COP con el formato de cada uno", () => {
    expect(monto(750, "USD")).toBe("USD 750");
    expect(monto(1234.5, "USD")).toBe("USD 1.234,50");
    expect(monto(2_000_000, "COP")).toBe("COP 2.000.000");
  });

  it("una moneda que el codigo no conoce igual se muestra con su codigo, nunca sin el", () => {
    // El dia que el negocio registre un abono en otra moneda, el numero no puede
    // salir desnudo ni convertido a USD.
    expect(monto(10, "EUR")).toBe("EUR 10");
  });
});

/**
 * Las fechas se guardan y viajan como 'YYYY-MM-DD' (columnas `date` de la base), pero
 * un reporte comercial no se lee en ISO. Los reportes diarios de Retia escriben
 * "14-ago a 21-sep", asi que el mes va abreviado a tres letras y en espanol.
 *
 * No se usa `Intl` a proposito: en es-CO devuelve "14 de ago de 2026" y "1 de sept de
 * 2026", que no es ni compacto ni como escribe el negocio.
 */
describe("fecha de calendario legible", () => {
  it("escribe el dia, el mes en tres letras y el ano", () => {
    expect(fecha("2026-08-14")).toBe("14 ago 2026");
    expect(fecha("2026-09-01")).toBe("1 sep 2026");
    expect(fecha("2026-12-31")).toBe("31 dic 2026");
  });

  it("no corre la fecha un dia por la zona horaria del servidor", () => {
    // Vercel corre en UTC y el equipo esta en Bogota (UTC-5). Si esto se parseara
    // como instante y se formateara en local, el 1 de septiembre saldria como 31 de
    // agosto. La fecha es un dia de calendario, no un instante.
    expect(fecha("2026-09-01")).toBe("1 sep 2026");
    expect(fecha("2026-01-01")).toBe("1 ene 2026");
  });

  it("lo que no es una fecha se devuelve tal cual, sin inventar un dia", () => {
    expect(fecha("")).toBe("");
    expect(fecha("sin fecha")).toBe("sin fecha");
  });
});
