import { expect, it } from "vitest";
import { crearModeloGrafica, crearOpcionGrafica, filasDeTabla } from "@/components/graficas/contrato";

const colores = {
  series: ["token-1", "token-2"],
  texto: "token-texto",
  textoSecundario: "token-secundario",
  divisor: "token-divisor",
  fondo: "token-fondo",
};

it("construye líneas, meta, cero y las filas de la tabla sin cambiar los valores", () => {
  const modelo = crearModeloGrafica({
    unidad: "cupos",
    dias: ["2026-10-01", "2026-10-02"],
    etiquetas: ["Hábil 1", "Hábil 2"],
    series: [
      { clave: "Octubre", valores: [12, 15] },
      { clave: "Septiembre", valores: [10, 12], punteada: true },
    ],
    comparacion: {
      texto: "contra el mismo punto de septiembre",
      pares: [{ actual: "Octubre", referencia: "Septiembre" }],
    },
    meta: { etiqueta: "Meta del mes", valores: [20, 20] },
    escribir: (valor) => `${valor} cupos`,
  });
  const opcion = crearOpcionGrafica(modelo, colores);

  expect(opcion.series.map((serie) => [serie.name, serie.type, serie.data])).toEqual([
    ["Octubre", "line", [12, 15]],
    ["Septiembre", "line", [10, 12]],
    ["Meta del mes", "line", [20, 20]],
  ]);
  expect(opcion.yAxis.min({ min: 12 })).toBe(0);
  expect(filasDeTabla(modelo)[1]).toEqual({
    dia: "2026-10-02",
    etiqueta: "Hábil 2",
    celdas: [
      { clave: "Octubre", texto: "15 cupos", enlace: null },
      { clave: "Septiembre", texto: "12 cupos", enlace: null },
      { clave: "Meta del mes", texto: "20 cupos", enlace: null },
    ],
  });
});

it("el tooltip nombra la comparación y muestra el cambio en número y porcentaje", () => {
  const modelo = crearModeloGrafica({
    unidad: "cupos",
    dias: ["2026-10-02"], etiquetas: ["Hábil 2"],
    series: [{ clave: "Octubre", valores: [15] }, { clave: "Septiembre", valores: [12] }],
    comparacion: { texto: "contra el mismo punto de septiembre", pares: [{ actual: "Octubre", referencia: "Septiembre" }] },
    escribir: (valor) => String(valor),
  });
  const opcion = crearOpcionGrafica(modelo, colores);
  const texto = opcion.tooltip.formatter([
    { seriesName: "Octubre", dataIndex: 0, value: 15 },
    { seriesName: "Septiembre", dataIndex: 0, value: 12 },
  ]);
  expect(texto).toContain("Hábil 2");
  expect(texto).toContain("contra el mismo punto de septiembre: 12 → 15");
  expect(texto).toContain("Cambio: +3 cupos · +25%");
});
