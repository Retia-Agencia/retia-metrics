import { describe, expect, it } from "vitest";
import type { ObjetivoDeCohorte } from "@/lib/catalogo/objetivos";
import { cifraDeCeldaSemanal, estadoDeCeldaSemanal } from "@/lib/pauta/cifra-de-celda-semanal";
import type { CeldaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";

/** La celda de la tabla semanal de Pauta como Cifra (419 paso 2): estado, línea pequeña, partes, parcial, en curso. */
const S1 = { desde: "2026-11-02", hasta: "2026-11-08" };
const S2 = { desde: "2026-11-09", hasta: "2026-11-15" };
const OK = { estado: "ok", razon: null } as const;
const celda = (valor: number | null, extra: Partial<CeldaPautaSemanal> = {}): CeldaPautaSemanal => ({ valor, cobertura: OK, ...extra });
const objetivo = (o: Partial<ObjetivoDeCohorte>): ObjetivoDeCohorte => ({
  id: "o", cohortId: "c", area: "paid", metrica: "costo_por_agenda", meta: 40_000, aceptable: 50_000, moneda: "COP", activo: true, ...o,
});

describe("419: la celda semanal de Pauta", () => {
  it("el costo por agenda trae estado del objetivo, partes con números y la línea pequeña", () => {
    const cifra = cifraDeCeldaSemanal({
      fila: { clave: "costo_agenda_crm" },
      celda: celda(44_800, { partes: [403_200, 9] }),
      rango: S2, esTotal: false, hoy: "2026-11-20",
      anterior: { celda: celda(40_000), rango: S1 },
      objetivos: [objetivo({})], programa: "Tactical", cohorte: "C6",
    });
    expect(cifra.estado).toEqual({ tono: "alerta", rotulo: "En seguimiento" });
    expect(cifra.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: COP 403.200 ÷ 9 = COP 44.800");
    expect(cifra.comparacion?.texto).toBe("la semana anterior (2-nov a 8-nov)");
    expect(cifra.explicacion.lectura.some(([rotulo]) => rotulo === "La línea pequeña")).toBe(true);
    expect(cifra.explicacion.filtros).toEqual([["Programa", "Tactical"], ["Cohorte", "C6"], ["Área", "Paid"], ["Semana", "9-nov a 15-nov"]]);
    expect(cifra.etiquetas).toEqual([]);
  });

  it("la columna Total no compara y la semana que no ha terminado dice En curso", () => {
    const total = cifraDeCeldaSemanal({ fila: { clave: "agendas" }, celda: celda(12), rango: { desde: S1.desde, hasta: S2.hasta }, esTotal: true, hoy: "2026-11-11", objetivos: [] });
    expect(total.comparacion).toBeNull();
    expect(total.explicacion.filtros.at(-1)).toEqual(["Periodo", "2-nov a 15-nov"]);
    expect(total.etiquetas).toEqual(["En curso"]);
    const cerrada = cifraDeCeldaSemanal({ fila: { clave: "agendas" }, celda: celda(5), rango: S1, esTotal: false, hoy: "2026-11-11", objetivos: [] });
    expect(cerrada.etiquetas).toEqual([]);
  });

  it("un vacío dice por qué y una cobertura parcial sale como Parcial con su motivo", () => {
    const vacia = cifraDeCeldaSemanal({ fila: { clave: "frecuencia" }, celda: celda(null, { cobertura: { estado: "sin_dato", razon: "Meta no da el alcance de varios días" } }), rango: S1, esTotal: false, hoy: "2026-11-20", objetivos: [] });
    expect(vacia.textoDelValor).toBe("—");
    expect(vacia.explicacion.lectura[0][1]).toContain("Meta no da el alcance de varios días");
    const parcial = cifraDeCeldaSemanal({ fila: { clave: "show" }, celda: celda(0.4, { cobertura: { estado: "parcial", razon: "2 de 12 citas pasadas siguen sin resultado" }, partes: [4, 10] }), rango: S1, esTotal: false, hoy: "2026-11-20", objetivos: [] });
    expect(parcial.etiquetas).toEqual(["Parcial"]);
    expect(parcial.explicacion.lectura).toContainEqual(["Parcial", "2 de 12 citas pasadas siguen sin resultado"]);
  });

  it("el objetivo de una tasa se carga en puntos y la celda la trae como fracción", () => {
    expect(estadoDeCeldaSemanal("agenda_venta", [objetivo({ metrica: "conversion_agenda_venta", meta: 10, aceptable: 6, moneda: null })]))
      .toEqual({ fuente: "objetivo", objetivo: 0.1, aceptable: 0.06, menorEsMejor: false });
    const cifra = cifraDeCeldaSemanal({ fila: { clave: "agenda_venta" }, celda: celda(0.12, { partes: [3, 25] }), rango: S1, esTotal: false, hoy: "2026-11-20", objetivos: [objetivo({ metrica: "conversion_agenda_venta", meta: 10, aceptable: 6, moneda: null })] });
    expect(cifra.estado?.tono).toBe("exito");
  });

  it("sin objetivo no hay estado; el de Paid gana al de todas las áreas; un costo en USD no colorea", () => {
    expect(estadoDeCeldaSemanal("costo_agenda_crm", [])).toBeUndefined();
    expect(estadoDeCeldaSemanal("ventas", [objetivo({})])).toBeUndefined();
    expect(estadoDeCeldaSemanal("costo_agenda_crm", [objetivo({ area: null, meta: 1 }), objetivo({ meta: 2 })])).toMatchObject({ objetivo: 2 });
    expect(estadoDeCeldaSemanal("costo_agenda_crm", [objetivo({ moneda: "USD" })])).toBeUndefined();
    expect(estadoDeCeldaSemanal("costo_agenda_crm", [objetivo({ activo: false })])).toBeUndefined();
    // Sin aceptable, lo que no cumple es rezagado.
    expect(estadoDeCeldaSemanal("roas", [objetivo({ metrica: "roas", meta: 3, aceptable: null, moneda: null })])).toMatchObject({ aceptable: 3 });
  });
});
