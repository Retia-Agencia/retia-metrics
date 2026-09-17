import { describe, expect, it } from "vitest";
import { resolverRango } from "@/lib/rangos";

/**
 * Ticket 005 — el selector de rango del dashboard.
 *
 * Es aritmetica de calendario pura: entra el preset y el dia de hoy (ya en Bogota,
 * 'YYYY-MM-DD'), sale el par de fechas que consumen las consultas del 004. Sin base
 * y sin reloj, asi que los casos de borde (cambio de mes, domingo, rango invertido)
 * se prueban directo.
 *
 * "Esta semana" y "este mes" van HASTA HOY, no hasta el fin del periodo (decision de
 * Mani, 17-sep): el dashboard es el reporte del dia y meter dias futuros en cero
 * ensuciaria las tasas y el cumplimiento.
 */

// 2026-09-15 es un martes.
const MARTES = "2026-09-15";

describe("presets de rango", () => {
  it("hoy es un solo dia", () => {
    expect(resolverRango({ preset: "hoy", hoy: MARTES })).toEqual({
      preset: "hoy",
      rango: { desde: MARTES, hasta: MARTES },
    });
  });

  it("la semana arranca el lunes y llega hasta hoy", () => {
    expect(resolverRango({ preset: "semana", hoy: MARTES }).rango).toEqual({
      desde: "2026-09-14",
      hasta: MARTES,
    });
  });

  it("un domingo, la semana sigue siendo la que arranco el lunes anterior", () => {
    // 2026-09-20 es domingo: el lunes de su semana es el 14, no el 21.
    expect(resolverRango({ preset: "semana", hoy: "2026-09-20" }).rango).toEqual({
      desde: "2026-09-14",
      hasta: "2026-09-20",
    });
  });

  it("el mes arranca el dia 1 y llega hasta hoy", () => {
    expect(resolverRango({ preset: "mes", hoy: MARTES }).rango).toEqual({
      desde: "2026-09-01",
      hasta: MARTES,
    });
  });
});

describe("el rango de la cohorte sale de su ventana de venta (ADR 0022)", () => {
  const ventana = { inicio: "2026-08-14", cierre: "2026-09-21" };

  it("va del inicio de ventas hasta hoy", () => {
    expect(resolverRango({ preset: "cohorte", hoy: MARTES, ventana }).rango).toEqual({
      desde: "2026-08-14",
      hasta: MARTES,
    });
  });

  it("si la cohorte ya cerro, no cuenta dias despues del cierre", () => {
    expect(resolverRango({ preset: "cohorte", hoy: "2026-10-05", ventana }).rango).toEqual({
      desde: "2026-08-14",
      hasta: "2026-09-21",
    });
  });

  it("sin ventana (cohorte sin inicio de ventas o sin cohorte activa) cae a hoy y lo dice", () => {
    // No se inventa una ventana: el preset que sale es el que de verdad se uso.
    const seleccion = resolverRango({ preset: "cohorte", hoy: MARTES, ventana: null });
    expect(seleccion).toEqual({ preset: "hoy", rango: { desde: MARTES, hasta: MARTES } });
  });
});

describe("rango custom", () => {
  it("respeta las dos fechas que le dan", () => {
    expect(
      resolverRango({ preset: "custom", hoy: MARTES, desde: "2026-09-01", hasta: "2026-09-10" }),
    ).toEqual({ preset: "custom", rango: { desde: "2026-09-01", hasta: "2026-09-10" } });
  });

  it("una fecha que no es una fecha cae a hoy en vez de reventar la pagina", () => {
    expect(
      resolverRango({ preset: "custom", hoy: MARTES, desde: "ayer", hasta: "2026-09-10" }).preset,
    ).toBe("hoy");
    expect(resolverRango({ preset: "custom", hoy: MARTES, desde: "2026-09-01" }).preset).toBe("hoy");
  });

  it("un rango invertido cae a hoy: un rango al reves no es una pregunta valida", () => {
    expect(
      resolverRango({ preset: "custom", hoy: MARTES, desde: "2026-09-10", hasta: "2026-09-01" })
        .preset,
    ).toBe("hoy");
  });
});

describe("preset desconocido", () => {
  it("un valor cualquiera en la URL cae a hoy", () => {
    expect(resolverRango({ preset: "lo-que-sea", hoy: MARTES })).toEqual({
      preset: "hoy",
      rango: { desde: MARTES, hasta: MARTES },
    });
  });
});
