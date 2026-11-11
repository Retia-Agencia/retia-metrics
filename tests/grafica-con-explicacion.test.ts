import { expect, it } from "vitest";
import { crearModeloGrafica, type ExplicacionDeSerie } from "@/components/graficas/contrato";
import { cifraDelPunto } from "@/components/graficas/grafica-con-explicacion";
import { explicacionDePauta } from "@/lib/metricas/explicaciones-de-pauta";

const modelo = crearModeloGrafica({
  unidad: "agendas",
  dias: ["2026-11-01", "2026-11-02"],
  etiquetas: ["1 nov", "2 nov"],
  series: [{ clave: "Agendadas", valores: [4, null] }, { clave: "Sin explicación", valores: [1, 1] }],
  escribir: String,
});
const explicaciones: Record<string, ExplicacionDeSerie> = {
  Agendadas: {
    entrada: { concepto: "agendas", explicacion: explicacionDePauta("agendas"), filtros: [["Área", "Paid"]] },
    paso: "Día", anterior: "el día anterior", motivoVacio: "Sin agendas ese día.",
  },
};

it("420: el clic en un punto arma la Cifra de esa serie en ese día, con el día en «Calculada con» y contra el anterior", () => {
  const primero = cifraDelPunto(modelo, explicaciones, 0, 0)!;
  expect(primero.valor).toBe(4);
  expect(primero.explicacion.filtros).toEqual([["Área", "Paid"], ["Día", "1 nov"]]);
  expect(primero.comparacion).toBeNull();
  const segundo = cifraDelPunto(modelo, explicaciones, 0, 1)!;
  expect(segundo.valor).toBeNull();
  expect(segundo.textoDelValor).toBe("—");
  expect(segundo.explicacion.filtros.at(-1)).toEqual(["Día", "2 nov"]);
});

it("420: una serie sin explicación no abre nada", () => {
  expect(cifraDelPunto(modelo, explicaciones, 1, 0)).toBeNull();
});
