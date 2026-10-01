import { afterEach, describe, expect, it, vi } from "vitest";
import { parsearPeriodoUrl, resolverPeriodo, type AtajoDePeriodo } from "@/lib/periodo";
import { hoyEnBogota } from "@/lib/format";
import { diasHabilesEntre } from "@/lib/dias-habiles";

const resolver = (preset: AtajoDePeriodo, hoy: string) => resolverPeriodo({ preset }, { hoy });
afterEach(() => vi.useRealTimers());
describe("periodo A contra B", () => {
  it("día hábil 7 del mes compara los primeros 7 del anterior", () => {
    const p = resolver("este_mes", "2026-10-09");
    expect(p.a).toEqual({ desde: "2026-10-01", hasta: "2026-10-09" });
    expect(p.b).toEqual({ desde: "2026-09-01", hasta: "2026-09-09" });
    expect(diasHabilesEntre(p.b!.desde, p.b!.hasta)).toBe(7);
  });
  it.each([
    ["2026-03-31", "2026-02-01", "2026-02-28"],
    ["2024-03-31", "2024-02-01", "2024-02-29"],
    ["2026-02-28", "2026-01-01", "2026-01-28"],
    ["2026-01-01", "2025-12-01", "2025-12-01"],
  ])("fin de mes / cuatro y cinco semanas: %s", (hoy, desde, hasta) => {
    expect(resolver("este_mes", hoy).b).toEqual({ desde, hasta });
  });
  it("el lunes compara solo el lunes anterior; pasada va de lunes a domingo", () => {
    expect(resolver("esta_semana", "2026-09-14").b).toEqual({ desde: "2026-09-07", hasta: "2026-09-07" });
    expect(resolver("semana_pasada", "2026-09-14").a).toEqual({ desde: "2026-09-07", hasta: "2026-09-13" });
  });
  it("a las 20:00 Bogotá sigue siendo hoy aunque UTC sea mañana", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T01:00:00Z"));
    expect(resolver("hoy", hoyEnBogota()).a).toEqual({ desde: "2026-10-01", hasta: "2026-10-01" });
  });
  it("ayer y mañana cruzan el año; un día no hábil no inventa B", () => {
    expect(resolver("ayer", "2026-01-01").a.desde).toBe("2025-12-31");
    expect(resolver("manana", "2026-12-31").a.desde).toBe("2027-01-01");
    expect(resolver("hoy", "2026-09-14").b?.desde).toBe("2026-09-11");
    expect(resolver("hoy", "2026-09-13").b).toBeNull();
  });
  it("mes pasado completo, aunque febrero sea bisiesto", () => {
    expect(resolver("mes_pasado", "2024-03-01").a).toEqual({ desde: "2024-02-01", hasta: "2024-02-29" });
  });
  it("sin anterior no inventa cohorte ni comparación", () => {
    const contexto = { hoy: "2026-10-09", actual: { inicio: "2026-10-01", cierre: "2026-10-30" } };
    expect(resolverPeriodo({ preset: "cohorte_actual" }, contexto).b).toBeNull();
    expect(resolverPeriodo({ preset: "cohorte_anterior" }, contexto).preset).toBe("hoy");
  });
  it("la cohorte usa ventana de venta, topa al cierre y compara hábiles", () => {
    const contexto = { hoy: "2026-10-09", actual: { inicio: "2026-10-01", cierre: "2026-10-08" }, anterior: { inicio: "2026-08-03", cierre: "2026-08-28" } };
    expect(resolverPeriodo({ preset: "cohorte_actual" }, contexto)).toMatchObject({ a: { desde: "2026-10-01", hasta: "2026-10-08" }, b: { desde: "2026-08-03", hasta: "2026-08-10" } });
    expect(resolverPeriodo({ preset: "cohorte_anterior" }, contexto).a).toEqual({ desde: "2026-08-03", hasta: "2026-08-28" });
  });
  it("rangos explícitos mandan sobre el atajo; conserva B elegido", () => {
    const entrada = parsearPeriodoUrl({ periodo: "este_mes", a_desde: "2026-09-01", a_hasta: "2026-09-04", b_desde: "2025-01-01", b_hasta: "2025-02-01" });
    expect(resolverPeriodo(entrada, { hoy: "2026-10-01" })).toMatchObject({ preset: "custom", a: { desde: "2026-09-01", hasta: "2026-09-04" }, b: { desde: "2025-01-01", hasta: "2025-02-01" } });
  });
  it.each([{ periodo: "no" }, { periodo: ["hoy", "ayer"] }, { a_desde: "2026-02-30", a_hasta: "2026-03-01" }, { a_desde: "2026-10-01" }, { b_desde: "2026-10-01" }, { a_desde: "2026-10-02", a_hasta: "2026-10-01" }])("URL inválida resuelve y anuncia Hoy: %j", (url) => {
    expect(parsearPeriodoUrl(url)).toMatchObject({ preset: "hoy", aviso: expect.any(String) });
  });
  it.each([["hoy", "hoy"], ["semana", "esta_semana"], ["mes", "este_mes"], ["cohorte", "cohorte_actual"]])("compatibilidad URL %s", (rango, preset) => {
    expect(parsearPeriodoUrl({ rango }).preset).toBe(preset);
  });
  it("URL vieja custom y B por defecto con festivo hábil", () => {
    const p = resolverPeriodo(parsearPeriodoUrl({ rango: "custom", desde: "2026-08-07", hasta: "2026-08-10" }), { hoy: "2026-10-01" });
    expect(p.b).toEqual({ desde: "2026-08-05", hasta: "2026-08-06" });
  });
  it("el atajo viejo ignora fechas sobrantes, igual que resolverRango", () => {
    const p = resolverPeriodo(parsearPeriodoUrl({ rango: "mes", desde: "2026-08-01", hasta: "2026-08-31" }), { hoy: "2026-10-01" });
    expect(p.preset).toBe("este_mes");
    expect(p.a.desde).toBe("2026-10-01");
  });
});
