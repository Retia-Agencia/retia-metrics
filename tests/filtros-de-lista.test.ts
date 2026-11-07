import { describe, expect, it, vi } from "vitest";
import {
  combinacionDeFiltrosValida,
  METRICAS_DE_LISTA,
  type FiltrosDeLista,
} from "@/lib/queries/filtros-de-lista";

vi.mock("@/lib/auth/page-guards", () => ({ paginaConCapacidad: vi.fn() }));
vi.mock("@/lib/auth/vista", () => ({ rolDeVista: vi.fn() }));
vi.mock("@/lib/auth/alcance", () => ({ programaVisiblePorSlug: vi.fn() }));

function valida(filtros: FiltrosDeLista, esAdmin = true) {
  return combinacionDeFiltrosValida(filtros, { esAdmin });
}

describe("filtros compartidos de las listas del Hub", () => {
  it("usa exactamente las opciones de métricas de la página", async () => {
    const { esquema } = await import("@/app/(app)/p/[programa]/hub/lista/page");
    expect(esquema.shape.metrica.options).toEqual(METRICAS_DE_LISTA);
  });

  it.each<[string, FiltrosDeLista, FiltrosDeLista]>([
    ["resultado", { metrica: "cierres", resultado: "show" }, { metrica: "agendas_creadas", resultado: "show" }],
    ["área de escalera", { metrica: "escalera", area: "paid" }, { metrica: "registros", area: "paid" }],
    ["pago", { metrica: "caja", pago: "completo" }, { metrica: "escalera", pago: "completo" }],
    ["origen ajeno", { metrica: "caja", source: "meta" }, { metrica: "registros", source: "meta" }],
    ["closer de pauta", { metrica: "pauta_meta", closer: "a".repeat(64), nivel: "total", paso: "registro" }, { metrica: "pauta_meta", nivel: "total", paso: "registro" }],
    ["orden", { metrica: "caja", orden: "envio" }, { metrica: "no_agendaron", orden: "envio" }],
    ["jerarquía de pauta", { metrica: "pauta_meta", nivel: "campana", paso: "registro" }, { metrica: "pauta_meta", nivel: "campana", id: "123", paso: "registro" }],
    ["jerarquía fuera de pauta", { metrica: "caja", nivel: "total" }, { metrica: "caja" }],
    ["escalón fuera de escalera", { metrica: "caja", escalon: "pago_en_llamada" }, { metrica: "escalera", escalon: "pago_en_llamada" }],
    ["escalón y grupo", { metrica: "escalera", escalon: "pago_en_llamada", grupo: "cerro_en_la_llamada" }, { metrica: "escalera", escalon: "pago_en_llamada" }],
    ["moneda", { metrica: "cierres", moneda: "USD" }, { metrica: "caja", moneda: "USD" }],
    ["origen del deal", { metrica: "cierres", origen: "manual" }, { metrica: "embudo_comercial_creados", origen: "manual" }],
    ["subconjunto de etapa faltante", { metrica: "etapa_paso" }, { metrica: "etapa_paso", etapa: "contactado" }],
    ["subconjunto ajeno", { metrica: "caja", etapa: "contactado" }, { metrica: "caja" }],
  ])("rechaza %s sin rechazar su combinación válida", (_regla, invalida, validaDeControl) => {
    expect(valida(invalida)).toBe(false);
    expect(valida(validaDeControl)).toBe(true);
  });

  it("trata la escalera con filtros de origen como lista de origen", () => {
    const filtros = { metrica: "escalera", source: "meta" } as const;
    expect(valida(filtros)).toBe(true);
    expect(valida({ ...filtros, closer: "a".repeat(64) }, false)).toBe(false);
  });

  it("pauta_meta exige nivel y paso, y ajusta el id al nivel", () => {
    expect(valida({ metrica: "pauta_meta" })).toBe(false);
    expect(valida({ metrica: "pauta_meta", nivel: "total", paso: "venta" })).toBe(true);
    expect(valida({ metrica: "pauta_meta", nivel: "total", id: "1", paso: "venta" })).toBe(false);
  });

  it("solo administración puede filtrar closer en listas de origen", () => {
    const filtros = { metrica: "registros", closer: "a".repeat(64) } as const;
    expect(valida(filtros, false)).toBe(false);
    expect(valida(filtros, true)).toBe(true);
  });
});
