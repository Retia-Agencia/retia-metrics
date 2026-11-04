import { expect, it } from "vitest";
import { crearModeloGrafica, crearOpcionGrafica } from "@/components/graficas/contrato";
import {
  configDeGraficaEnOrigen,
  desplazarAlEjeDeA,
  etiquetaDeTramo,
  hrefConConfigDeGrafica,
  indicesDeTramos,
  leerConfigDeGrafica,
  pasoPorDefecto,
  tramosDe,
  valoresDeAcumulado,
  valoresPorTramo,
} from "@/lib/series-pasos";

const hoy = "2026-11-04";
const colores = { series: ["a", "b"], texto: "t", textoSecundario: "s", divisor: "d", fondo: "f" };

it("el paso por defecto sale del largo: día hasta 31 días, semana hasta 26 semanas, mes después", () => {
  expect(pasoPorDefecto({ desde: "2026-10-05", hasta: "2026-11-04" })).toBe("dia");
  expect(pasoPorDefecto({ desde: "2026-09-25", hasta: "2026-11-04" })).toBe("semana"); // 41 días
  expect(pasoPorDefecto({ desde: "2026-01-01", hasta: "2026-11-04" })).toBe("mes");
});

it("el eje arranca en el primer día del periodo (la primera venta de C3) y lleva una fecha por punto", () => {
  const desde = "2026-09-23";
  const tramos = tramosDe({ desde, hasta: hoy }, "dia", hoy);
  expect(tramos[0].desde).toBe(desde);
  expect(tramos.at(-1)!.hasta).toBe(hoy);
  const modelo = crearModeloGrafica({
    unidad: "cupos", dias: tramos.map((t) => t.desde), etiquetas: tramos.map(etiquetaDeTramo),
    series: [{ clave: "C3", valores: tramos.map(() => 1) }], escribir: String,
  });
  expect(modelo.etiquetas[0]).toBe("23 sep");
  expect(modelo.etiquetas.every((e) => !e.includes("/"))).toBe(true);
  expect(new Set(modelo.etiquetas).size).toBe(modelo.etiquetas.length);
  expect(crearOpcionGrafica(modelo, colores).yAxis.name).toBe("cupos");
});

it("semana de lunes a domingo, recortada al periodo y con el tramo de hoy en curso", () => {
  const tramos = tramosDe({ desde: "2026-10-14", hasta: "2026-11-30" }, "semana", hoy);
  expect(tramos[0]).toMatchObject({ desde: "2026-10-14", hasta: "2026-10-18", enCurso: false });
  expect(tramos[1]).toMatchObject({ desde: "2026-10-19", hasta: "2026-10-25" });
  expect(tramos.at(-1)).toMatchObject({ desde: "2026-11-02", hasta: "2026-11-04", enCurso: true });
  expect(etiquetaDeTramo(tramos.at(-1)!)).toContain("(en curso)");
  const meses = tramosDe({ desde: "2026-09-20", hasta: "2026-12-31" }, "mes", hoy);
  expect(meses.map((m) => [m.desde, m.hasta])).toEqual([["2026-09-20", "2026-09-30"], ["2026-10-01", "2026-10-31"], ["2026-11-01", "2026-11-04"]]);
});

it("el último punto acumulado es el total del periodo, en cualquier paso, y por paso suma lo mismo", () => {
  const porDia = new Map([["2026-10-01", 3], ["2026-10-07", 2], ["2026-11-03", 4]]);
  const rango = { desde: "2026-10-01", hasta: hoy };
  for (const paso of ["dia", "semana", "mes"] as const) {
    const tramos = tramosDe(rango, paso, hoy);
    expect(valoresPorTramo(porDia, tramos, "acum").at(-1)).toBe(9);
    expect(valoresPorTramo(porDia, tramos, "paso").reduce((n, v) => n! + v!, 0)).toBe(9);
  }
});

it("la comparación se pone día a día sobre el eje de A y se corta donde B se acaba", () => {
  const a = { desde: "2026-10-01", hasta: "2026-10-05" };
  const b = { desde: "2026-09-01", hasta: "2026-09-03" };
  const { porDia, hastaDatos } = desplazarAlEjeDeA(new Map([["2026-09-01", 5], ["2026-09-03", 1], ["2026-09-09", 99]]), a, b);
  expect(hastaDatos).toBe("2026-10-03");
  const tramos = tramosDe(a, "dia", hoy);
  expect(valoresPorTramo(porDia, tramos, "acum", hastaDatos)).toEqual([5, 5, 6, null, null]);
});

it("un acumulado por punto se lee por tramo: al cierre o por diferencia", () => {
  const dias = ["2026-11-02", "2026-11-03", "2026-11-04"]; // hábiles
  const tramos = tramosDe({ desde: "2026-10-30", hasta: hoy }, "semana", hoy);
  const indices = indicesDeTramos(dias, tramos);
  expect(indices).toEqual([-1, 2]);
  expect(valoresDeAcumulado([1, 4, 9], indices, "acum")).toEqual([0, 9]);
  expect(valoresDeAcumulado([1, 4, 9], indices, "paso")).toEqual([0, 9]);
  expect(valoresDeAcumulado([1, null], [0, 1], "acum")).toEqual([1, null]);
});

it("los tres interruptores viajan en la URL y un valor raro cae al predeterminado", () => {
  const base = { unidad: "cupos", paso: "dia", forma: "acum" } as const;
  expect(leerConfigDeGrafica("plata,semana,paso", base)).toEqual({ unidad: "plata", paso: "semana", forma: "paso" });
  expect(leerConfigDeGrafica("mes,plata", base)).toEqual({ unidad: "plata", paso: "mes", forma: "acum" });
  expect(leerConfigDeGrafica("basura,,;", base)).toEqual(base);
  const href = hrefConConfigDeGrafica("/p/x/hub?seccion=dinero&cohorte=abc", "ventas", { unidad: "plata", paso: "semana", forma: "acum" });
  expect(href).toBe("/p/x/hub?seccion=dinero&cohorte=abc&g_ventas=plata%2Csemana%2Cacum");
  expect(configDeGraficaEnOrigen(href, "ventas", base)).toEqual({ unidad: "plata", paso: "semana", forma: "acum" });
});

it("Dinero usa una sola clave con paso y forma, e ignora una unidad vieja", () => {
  const base = { unidad: "cupos", paso: "dia", forma: "acum" } as const;
  const origen = hrefConConfigDeGrafica("/p/x/hub?seccion=dinero", "dinero", { unidad: "cupos", paso: "semana", forma: "paso" }, { sinUnidad: true });
  expect(origen).toBe("/p/x/hub?seccion=dinero&g_dinero=semana%2Cpaso");
  expect(configDeGraficaEnOrigen(origen, "dinero", base, { unidadFija: "cupos" })).toEqual({ unidad: "cupos", paso: "semana", forma: "paso" });
  expect(configDeGraficaEnOrigen("/p/x/hub?g_dinero=plata,mes,acum", "dinero", base, { unidadFija: "cupos" }))
    .toEqual({ unidad: "cupos", paso: "mes", forma: "acum" });
});

it("guardián: ninguna serie del Hub escribe un número de meses ni compara por su cuenta", async () => {
  const { readFileSync } = await import("node:fs");
  const archivos = [
    "lib/queries/series-dinero.ts",
    "lib/series-pasos.ts",
    "components/dashboard/graficas-de-dinero.tsx",
    "components/dashboard/dinero.tsx",
    "components/deals-contra-agendas.tsx",
  ];
  for (const archivo of archivos) {
    const texto = readFileSync(archivo, "utf8");
    expect(texto, archivo).not.toMatch(/Array\.from\(\{ length: \d+ \}|Últimos (seis|\d+) meses|moverMes\(/);
    expect(texto, archivo).not.toContain("independientemente de “Comparar con”");
  }
});
