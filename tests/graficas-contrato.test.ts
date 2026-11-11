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
  ]);
  expect(modelo.meta).toEqual({ etiqueta: "Meta del mes", textos: ["20 cupos", "20 cupos"] });
  expect([opcion.yAxis].flat()[0].min({ min: 12 })).toBe(0);
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

it("el tooltip muestra una línea corta por comparación y omite texto cuando no hay comparación", () => {
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
  expect(texto).toContain("Septiembre: 12 cupos (+3, +25 %)");
  expect([opcion.yAxis].flat()[0].name).toBe("cupos");
  expect(texto).not.toContain("→");
  expect(texto).not.toContain("Sin comparación");
  const sinComparacion = crearOpcionGrafica(crearModeloGrafica({
    unidad: "cupos", dias: ["2026-10-02"], etiquetas: ["Hábil 2"],
    series: [{ clave: "Octubre", valores: [15] }], escribir: String,
  }), colores).tooltip.formatter({ seriesName: "Octubre", dataIndex: 0, value: 15 });
  expect(sinComparacion).not.toContain("Sin comparación");
});

it("el tooltip pinta los extras del punto después de su valor", () => {
  const modelo = crearModeloGrafica({
    unidad: "cupos", dias: ["2026-11-04"], etiquetas: ["4 nov"],
    series: [{
      clave: "Noviembre", valores: [2],
      extras: [[{ etiqueta: "Vendido", texto: "USD 1.500,00" }, { etiqueta: "Entró a caja", texto: "COP 20.000" }]],
    }],
    escribir: String,
  });
  const texto = crearOpcionGrafica(modelo, colores).tooltip.formatter({ seriesName: "Noviembre", dataIndex: 0, value: 2 });
  expect(texto).toContain("Noviembre: 2 cupos<br>Vendido: USD 1.500,00<br>Entró a caja: COP 20.000");
});

it("420: barra y línea en la misma gráfica, cada una en su eje, con su unidad y su formato", () => {
  const modelo = crearModeloGrafica({
    tipo: "linea",
    unidad: "COP",
    unidadSecundaria: "agendas",
    dias: ["2026-11-01", "2026-11-02"],
    etiquetas: ["1 nov", "2 nov"],
    series: [
      { clave: "Inversión", valores: [900000, null], tipo: "barra", eje: 0, unidad: "" },
      { clave: "Agendadas", valores: [4, 2], tipo: "linea", eje: 1 },
    ],
    escribir: String,
    formatos: { "Inversión": (v) => `COP ${v}` },
    zoom: true,
    pista: "Clic para ver cómo se calcula",
  });
  expect(modelo.series[0].textos).toEqual(["COP 900000", null]);
  const opcion = crearOpcionGrafica(modelo, { ...colores, relleno: "token-suave" });
  const ejes = [opcion.yAxis].flat();
  expect(ejes.map((eje) => [eje.name, eje.position])).toEqual([["COP", "left"], ["agendas", "right"]]);
  expect(opcion.series.map((s) => [s.type, s.yAxisIndex])).toEqual([["bar", 0], ["line", 1]]);
  // Barras en el relleno suave con el borde del color de la serie; en una mixta no se escriben valores encima.
  expect(opcion.series[0].itemStyle).toMatchObject({ color: "token-suave", borderColor: "token-1" });
  expect(opcion.series.every((s) => s.label.show === false)).toBe(true);
  expect(opcion.legend).toMatchObject({ left: "center" });
  expect(opcion.dataZoom).toHaveLength(2);
  const texto = opcion.tooltip.formatter([
    { seriesName: "Inversión", dataIndex: 0, value: 900000 },
    { seriesName: "Agendadas", dataIndex: 0, value: 4 },
  ]);
  expect(texto).toContain("Inversión: COP 900000<br>Agendadas: 4 agendas");
  expect(texto).toContain("Clic para ver cómo se calcula");
});

it("420: sin unidad secundaria queda un solo eje y sin zoom, como antes", () => {
  const opcion = crearOpcionGrafica(crearModeloGrafica({ unidad: "cupos", dias: ["a"], etiquetas: ["a"], series: [{ clave: "x", valores: [1] }], escribir: String }), colores);
  expect(Array.isArray(opcion.yAxis)).toBe(false);
  expect("dataZoom" in opcion).toBe(false);
});
