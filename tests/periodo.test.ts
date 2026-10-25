import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comparacionesDe,
  descripcionDeComparacion,
  parametrosDeComparaciones,
  parsearPeriodoUrl,
  resolverPeriodo,
  type AtajoDePeriodo,
} from "@/lib/periodo";
import { hoyEnBogota } from "@/lib/format";
import { diasHabilesEntre } from "@/lib/dias-habiles";

const anterior = [{ tipo: "anterior" as const }];
const resolver = (preset: AtajoDePeriodo, hoy: string) => resolverPeriodo({ preset, comparaciones: anterior }, { hoy });
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
    expect(resolverPeriodo({ preset: "cohorte_actual", comparaciones: anterior }, contexto).b).toBeNull();
    expect(resolverPeriodo({ preset: "cohorte_anterior" }, contexto).preset).toBe("hoy");
  });
  it("la cohorte usa ventana de venta, topa al cierre y compara hábiles", () => {
    const contexto = { hoy: "2026-10-09", actual: { inicio: "2026-10-01", cierre: "2026-10-08" }, anterior: { inicio: "2026-08-03", cierre: "2026-08-28" } };
    expect(resolverPeriodo({ preset: "cohorte_actual", comparaciones: anterior }, contexto)).toMatchObject({ a: { desde: "2026-10-01", hasta: "2026-10-08" }, b: { desde: "2026-08-03", hasta: "2026-08-10" } });
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
  it("URL vieja custom: sin comparar no hay B; el anterior pedido cuenta el festivo como hábil", () => {
    const vieja = { rango: "custom", desde: "2026-08-07", hasta: "2026-08-10" };
    expect(resolverPeriodo(parsearPeriodoUrl(vieja), { hoy: "2026-10-01" }).b).toBeNull();
    const p = resolverPeriodo(parsearPeriodoUrl({ periodo: "custom", a_desde: vieja.desde, a_hasta: vieja.hasta, comparar: "anterior" }), { hoy: "2026-10-01" });
    expect(p.b).toEqual({ desde: "2026-08-05", hasta: "2026-08-06" });
  });
  it("el atajo viejo ignora fechas sobrantes, igual que resolverRango", () => {
    const p = resolverPeriodo(parsearPeriodoUrl({ rango: "mes", desde: "2026-08-01", hasta: "2026-08-31" }), { hoy: "2026-10-01" });
    expect(p.preset).toBe("este_mes");
    expect(p.a.desde).toBe("2026-10-01");
  });
  it("cada opción de comparación conserva el contrato de rangos", () => {
    const contexto = {
      hoy: "2026-10-09",
      anterior: { inicio: "2026-08-03", cierre: "2026-08-28" },
    };
    const base = { periodo: "este_mes" };
    expect(resolverPeriodo(parsearPeriodoUrl(base), contexto)).toMatchObject({ b: null, comparaciones: [], aviso: undefined });
    expect(resolverPeriodo(parsearPeriodoUrl({ ...base, comparar: "anterior" }), contexto).b).toEqual({ desde: "2026-09-01", hasta: "2026-09-09" });
    expect(resolverPeriodo(parsearPeriodoUrl({ ...base, comparar: "cohorte" }), contexto).b).toEqual({ desde: "2026-08-03", hasta: "2026-08-11" });
    expect(resolverPeriodo(parsearPeriodoUrl({ ...base, b_desde: "2026-07-01", b_hasta: "2026-07-09" }), contexto).b).toEqual({ desde: "2026-07-01", hasta: "2026-07-09" });
    expect(resolverPeriodo(parsearPeriodoUrl({ ...base, comparar: "no" }), contexto)).toMatchObject({ b: null, aviso: undefined });
  });
  it("un rango explícito gana sobre comparar", () => {
    const entrada = parsearPeriodoUrl({ periodo: "este_mes", comparar: "no", b_desde: "2026-07-01", b_hasta: "2026-07-09" });
    expect(resolverPeriodo(entrada, { hoy: "2026-10-09" }).b).toEqual({ desde: "2026-07-01", hasta: "2026-07-09" });
  });
  it("cohorte sin ventana anterior conserva el aviso existente en palabras", () => {
    const periodo = resolverPeriodo(parsearPeriodoUrl({ periodo: "este_mes", comparar: "cohorte" }), { hoy: "2026-10-09" });
    expect(periodo.b).toBeNull();
    expect(periodo.aviso).toBe("Sin cohorte anterior con ventana de venta. Elige un rango para comparar.");
  });
  it("una URL inválida de comparación usa la caída existente", () => {
    expect(parsearPeriodoUrl({ periodo: "este_mes", comparar: "otra" })).toMatchObject({ preset: "hoy", aviso: "Periodo inválido: se muestra Hoy." });
  });
  it("por defecto no compara y el atajo por defecto lo decide quien llama", () => {
    expect(parsearPeriodoUrl({})).toMatchObject({ preset: "hoy", comparaciones: [] });
    expect(parsearPeriodoUrl({}, { porDefecto: "cohorte_actual" })).toMatchObject({ preset: "cohorte_actual", comparaciones: [] });
    expect(parsearPeriodoUrl({ seccion: "comercial" }, { porDefecto: "cohorte_actual" }).preset).toBe("cohorte_actual");
    expect(parsearPeriodoUrl({ comparar: "cohorte" }, { porDefecto: "cohorte_actual" }).preset).toBe("cohorte_actual");
    expect(parsearPeriodoUrl({ periodo: "hoy" }, { porDefecto: "cohorte_actual" }).preset).toBe("hoy");
    expect(parsearPeriodoUrl({ rango: "mes" }, { porDefecto: "cohorte_actual" }).preset).toBe("este_mes");
  });
  it("en código, sin comparaciones pedidas, rige la forma vieja: el periodo anterior", () => {
    expect(resolverPeriodo({ preset: "este_mes" }, { hoy: "2026-10-09" }).b).toEqual({ desde: "2026-09-01", hasta: "2026-09-09" });
    expect(resolverPeriodo({ preset: "este_mes", comparar: "no" }, { hoy: "2026-10-09" }).b).toBeNull();
    expect(resolverPeriodo({ preset: "este_mes", comparaciones: [] }, { hoy: "2026-10-09" }).b).toBeNull();
  });
  it("dos comparaciones por URL se resuelven en orden y b es la primera", () => {
    const contexto = { hoy: "2026-10-09", anterior: { inicio: "2026-08-03", cierre: "2026-08-28" } };
    const p = resolverPeriodo(parsearPeriodoUrl({ periodo: "este_mes", comparar: "cohorte,2026-07-01_2026-07-09" }), contexto);
    expect(comparacionesDe(p).map((c) => c.rango)).toEqual([
      { desde: "2026-08-03", hasta: "2026-08-11" },
      { desde: "2026-07-01", hasta: "2026-07-09" },
    ]);
    expect(p.b).toEqual({ desde: "2026-08-03", hasta: "2026-08-11" });
  });
  it("una comparación que no se resuelve no corre a las demás y deja su aviso", () => {
    const p = resolverPeriodo(parsearPeriodoUrl({ periodo: "este_mes", comparar: "cohorte,2026-07-01_2026-07-09" }), { hoy: "2026-10-09" });
    expect(p.b).toEqual({ desde: "2026-07-01", hasta: "2026-07-09" });
    expect(p.aviso).toBe("Sin cohorte anterior con ventana de venta. Elige un rango para comparar.");
  });
  it("la URL vieja con b_desde va primero y se suma a comparar", () => {
    const entrada = parsearPeriodoUrl({ periodo: "este_mes", comparar: "cohorte", b_desde: "2026-07-01", b_hasta: "2026-07-09" });
    expect(entrada.comparaciones).toEqual([{ tipo: "rango", rango: { desde: "2026-07-01", hasta: "2026-07-09" } }, { tipo: "cohorte" }]);
  });
  it("las repetidas se juntan; más de tres o un rango al revés invalidan", () => {
    expect(parsearPeriodoUrl({ comparar: "anterior,anterior" }).comparaciones).toEqual([{ tipo: "anterior" }]);
    for (const comparar of ["anterior,cohorte,2026-07-01_2026-07-09,2026-06-01_2026-06-09", "2026-07-09_2026-07-01", "2026-02-30_2026-03-01", "anterior,", "no,cohorte"]) {
      expect(parsearPeriodoUrl({ periodo: "este_mes", comparar })).toMatchObject({ preset: "hoy", aviso: "Periodo inválido: se muestra Hoy." });
    }
  });
  it("escribe la lista en una sola clave y limpia las viejas", () => {
    expect(parametrosDeComparaciones([])).toEqual({ comparar: null, b_desde: null, b_hasta: null });
    expect(parametrosDeComparaciones([{ tipo: "cohorte" }, { tipo: "rango", rango: { desde: "2026-09-01", hasta: "2026-09-09" } }, { tipo: "cohorte" }]))
      .toEqual({ comparar: "cohorte,2026-09-01_2026-09-09", b_desde: null, b_hasta: null });
    // Ida y vuelta: lo que se escribe se lee igual.
    const { comparar } = parametrosDeComparaciones([{ tipo: "anterior" }, { tipo: "rango", rango: { desde: "2026-09-01", hasta: "2026-09-09" } }]);
    expect(parsearPeriodoUrl({ comparar }).comparaciones).toEqual([{ tipo: "anterior" }, { tipo: "rango", rango: { desde: "2026-09-01", hasta: "2026-09-09" } }]);
  });
  it("describe la comparación en palabras", () => {
    const contexto = { hoy: "2026-10-09", anterior: { inicio: "2026-08-03", cierre: "2026-08-28" } };
    const rango = resolverPeriodo(parsearPeriodoUrl({ periodo: "este_mes", comparar: "2026-09-01_2026-09-09" }), contexto);
    expect(descripcionDeComparacion(rango)).toBe("contra 1 sep 2026 a 9 sep 2026");
    expect(descripcionDeComparacion(resolverPeriodo(parsearPeriodoUrl({ periodo: "este_mes", comparar: "cohorte" }), contexto))).toBe("contra la cohorte anterior al mismo día hábil");
    expect(descripcionDeComparacion(resolverPeriodo(parsearPeriodoUrl({ periodo: "este_mes", comparar: "anterior" }), contexto))).toBe("contra el periodo anterior al mismo día hábil");
    expect(descripcionDeComparacion({ ...rango, b: null, comparaciones: undefined })).toBe("sin comparación");
  });
});
