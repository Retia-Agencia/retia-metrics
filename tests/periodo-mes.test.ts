import { afterEach, describe, expect, it, vi } from "vitest";
import { parsearPeriodoUrl, rangoDeMes, resolverPeriodo } from "@/lib/periodo";
import { hoyEnBogota } from "@/lib/format";

afterEach(() => vi.useRealTimers());

describe("periodo AAAA-MM (ticket 400)", () => {
  it.each([
    ["2026-04", "2026-04-30"], // 30 días
    ["2026-10", "2026-10-31"], // 31 días
    ["2026-02", "2026-02-28"], // 28 días
    ["2028-02", "2028-02-29"], // 29 días (bisiesto)
    ["2026-12", "2026-12-31"], // cambio de año
  ])("%s va del día 1 a %s", (mes, ultimo) => {
    expect(rangoDeMes(mes)).toEqual({ desde: `${mes}-01`, hasta: ultimo });
  });

  it.each(["octubre", "2026-13", "2026-00", "2026-1", "26-10", "1999-12", "2026-10-01", ""])(
    "rechaza %j", (texto) => expect(rangoDeMes(texto)).toBeNull(),
  );

  it("la URL lo lee como un periodo custom con las fechas del mes", () => {
    const entrada = parsearPeriodoUrl({ periodo: "2026-10" });
    expect(entrada).toMatchObject({ preset: "custom", a: { desde: "2026-10-01", hasta: "2026-10-31" } });
    expect(entrada.aviso).toBeUndefined();
    expect(entrada.predeterminado).toBeUndefined();
  });

  it("un mes con fechas propias a la vez es ambiguo: cae a Hoy con aviso", () => {
    expect(parsearPeriodoUrl({ periodo: "2026-10", a_desde: "2026-10-05" }).aviso).toBeTruthy();
    expect(parsearPeriodoUrl({ periodo: "2026-13" }).aviso).toBeTruthy();
  });

  it("no depende de la hora de Bogotá ni de la zona del proceso: a las 20:00 del 31 sigue siendo octubre", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T01:30:00Z")); // 20:30 del 31-oct en Bogotá, ya 1-nov en UTC
    expect(hoyEnBogota()).toBe("2026-10-31");
    const resuelto = resolverPeriodo(parsearPeriodoUrl({ periodo: "2026-10" }), { hoy: hoyEnBogota() });
    expect(resuelto.a).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
  });
});
