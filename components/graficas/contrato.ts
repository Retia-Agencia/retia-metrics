import type { EntradaDeCifra } from "@/lib/metricas/cifra";

export interface SerieDeGrafica {
  clave: string;
  valores: Array<number | null>;
  /** Barra o línea para ESTA serie: una gráfica puede mezclar las dos (420). Sin él, el `tipo` de la gráfica. */
  tipo?: "linea" | "barra";
  /** 1 = el eje de la derecha (`unidadSecundaria`): dos unidades nunca comparten eje (COP y USD, COP y agendas). */
  eje?: 0 | 1;
  /** La unidad que el tooltip escribe tras el valor; "" cuando el texto ya la trae ("COP 900.000"). */
  unidad?: string;
  punteada?: boolean;
  color?: number;
  enlaces?: Array<string | null>;
  extras?: Array<Array<{ etiqueta: string; texto: string }>>;
  resumenes?: Array<ResumenDePunto | null>;
}

/**
 * Lo que una serie necesita para que el clic en un punto abra su explicación (420, la del 419): la entrada de la Cifra
 * sin valor ni periodo, que el punto completa. Es serializable: el cliente arma la Cifra con `armarCifra` al hacer clic.
 */
export interface ExplicacionDeSerie {
  entrada: Omit<EntradaDeCifra, "valor" | "periodo" | "comparacion" | "lista" | "linea">;
  /** El chip de "Calculada con" del punto: "Día" o "Semana". */
  paso: string;
  /** Contra qué se compara el punto: "el día anterior", "la semana anterior". */
  anterior: string;
  /** "acumulado hasta" cuando la forma es Acumulado. */
  prefijo?: string;
  /** Por qué un punto no tiene valor. */
  motivoVacio: string;
}

export interface ResumenDePunto {
  metrica: "cierres" | "caja";
  desde: string;
  hasta: string;
  cohorteId: string | null;
  claveCloser: string | null;
}

export interface ComparacionDeGrafica {
  texto: string;
  pares: Array<{ actual: string; referencia: string }>;
}

export interface MetaDeGrafica {
  etiqueta: string;
  valores: Array<number | null>;
  color?: number;
}

export interface EntradaDeGrafica {
  tipo?: "linea" | "barra";
  unidad: string;
  dias: string[];
  etiquetas: string[];
  series: SerieDeGrafica[];
  comparacion?: ComparacionDeGrafica;
  meta?: MetaDeGrafica;
  escribir: (valor: number) => string;
  /** El formato de una serie en particular, por su clave (una gráfica con COP y agendas). */
  formatos?: Readonly<Record<string, (valor: number) => string>>;
  /** La unidad del eje de la derecha; sin ella hay un solo eje. */
  unidadSecundaria?: string;
  /** Rueda y deslizador abajo para acercar (solo por día). */
  zoom?: boolean;
  /** Una línea al pie del tooltip ("Clic para ver cómo se calcula"). */
  pista?: string;
}

export interface ModeloDeGrafica {
  tipo: "linea" | "barra";
  unidad: string;
  dias: string[];
  etiquetas: string[];
  series: Array<SerieDeGrafica & { textos: Array<string | null> }>;
  meta?: { etiqueta: string; textos: Array<string | null> };
  unidadSecundaria?: string;
  zoom?: boolean;
  pista?: string;
  comparacion?: ComparacionDeGrafica & {
    cambios: Record<string, Array<{ numero: string; porcentaje: string } | null>>;
  };
}

export interface FilaDeTabla {
  dia: string;
  etiqueta: string;
  celdas: Array<{ clave: string; texto: string; enlace: string | null }>;
}

const signo = (valor: number) => valor > 0 ? "+" : valor < 0 ? "−" : "";

/** Convierte datos de negocio y su formateador en el modelo serializable del cliente. */
export function crearModeloGrafica(entrada: EntradaDeGrafica): ModeloDeGrafica {
  const escribirDe = (clave: string) => entrada.formatos?.[clave] ?? entrada.escribir;
  const series = entrada.series.map((serie) => ({
    ...serie,
    textos: serie.valores.map((valor) => valor === null ? null : escribirDe(serie.clave)(valor)),
  }));
  const porClave = new Map(series.map((serie) => [serie.clave, serie]));
  const cambios: NonNullable<ModeloDeGrafica["comparacion"]>["cambios"] = {};

  for (const par of entrada.comparacion?.pares ?? []) {
    const actual = porClave.get(par.actual);
    const referencia = porClave.get(par.referencia);
    cambios[par.actual] = entrada.dias.map((_, i) => {
      const a = actual?.valores[i];
      const b = referencia?.valores[i];
      if (a === null || a === undefined || b === null || b === undefined) return null;
      const delta = a - b;
      return {
        numero: `${signo(delta)}${escribirDe(par.actual)(Math.abs(delta))}`,
        porcentaje: b === 0 ? "—" : `${signo(delta)}${Math.round(Math.abs(delta / b) * 100)} %`,
      };
    });
  }

  return {
    tipo: entrada.tipo ?? "linea",
    unidad: entrada.unidad,
    dias: entrada.dias,
    etiquetas: entrada.etiquetas,
    series,
    meta: entrada.meta ? {
      etiqueta: entrada.meta.etiqueta,
      textos: entrada.meta.valores.map((valor) => valor === null ? null : entrada.escribir(valor)),
    } : undefined,
    comparacion: entrada.comparacion ? { ...entrada.comparacion, cambios } : undefined,
    ...(entrada.unidadSecundaria ? { unidadSecundaria: entrada.unidadSecundaria } : {}),
    ...(entrada.zoom ? { zoom: true } : {}),
    ...(entrada.pista ? { pista: entrada.pista } : {}),
  };
}

/** La unidad que el tooltip escribe tras el valor de una serie. */
export function unidadDeSerie(modelo: ModeloDeGrafica, serie: SerieDeGrafica): string {
  if (serie.unidad !== undefined) return serie.unidad;
  return serie.eje === 1 && modelo.unidadSecundaria ? modelo.unidadSecundaria : modelo.unidad;
}

export function filasDeTabla(modelo: ModeloDeGrafica): FilaDeTabla[] {
  return modelo.dias.map((dia, i) => ({
    dia,
    etiqueta: modelo.etiquetas[i],
    celdas: [...modelo.series.map((serie) => ({
      clave: serie.clave,
      texto: serie.textos[i] ?? "—",
      enlace: serie.enlaces?.[i] ?? null,
    })), ...(modelo.meta ? [{ clave: modelo.meta.etiqueta, texto: modelo.meta.textos[i] ?? "—", enlace: null }] : [])],
  }));
}

interface ColoresDeGrafica {
  series: string[];
  texto: string;
  textoSecundario: string;
  divisor: string;
  fondo: string;
  /** El relleno de las barras de una gráfica mixta (`marca-suave`); el borde es el color de la serie. */
  relleno?: string;
}

interface ParametroTooltip { seriesName?: string; dataIndex?: number; value?: number | null }

/** Con más puntos que esto solo el último lleva su valor escrito: el resto estorba y vive en el tooltip y la tabla. */
const ETIQUETAS_HASTA = 8;

/** 4000 se lee "4K" y 2500000 "2,5M" en el eje; el valor exacto va en el tooltip y en la tabla. */
function abreviar(valor: number): string {
  const abs = Math.abs(valor);
  const corto = (n: number, sufijo: string) => `${String(Math.round(n * 10) / 10).replace(".", ",")}${sufijo}`;
  if (abs >= 1_000_000) return corto(valor / 1_000_000, "M");
  if (abs >= 10_000) return corto(valor / 1_000, "K");
  return String(Math.round(valor * 100) / 100).replace(".", ",");
}

const escapar = (texto: string) => texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Único constructor de opciones ECharts: ejes lineales, cero visible y tooltip comparable. */
export function crearOpcionGrafica(modelo: ModeloDeGrafica, colores: ColoresDeGrafica) {
  const porClave = new Map(modelo.series.map((serie) => [serie.clave, serie]));
  return {
    animation: false,
    aria: { enabled: true, decal: { show: true } },
    color: colores.series,
    grid: { left: 12, right: 16, top: 56, bottom: modelo.zoom ? 40 : 16, containLabel: true },
    legend: { top: 0, left: "center", textStyle: { color: colores.texto } },
    tooltip: {
      trigger: "axis",
      backgroundColor: colores.fondo,
      borderColor: colores.divisor,
      textStyle: { color: colores.texto },
      formatter(parametros: ParametroTooltip | ParametroTooltip[]) {
        const lista = Array.isArray(parametros) ? parametros : [parametros];
        const indice = lista[0]?.dataIndex ?? 0;
        const lineas = [`<strong>${escapar(modelo.etiquetas[indice] ?? modelo.dias[indice] ?? "")}</strong>`];
        // Una línea por serie. La comparación se dice en la línea de la referencia: "C2 al mismo día: 9 cupos (+3, +33 %)",
        // el cambio de la serie actual contra ella, sin una línea aparte que haya que descifrar.
        const cambiosPorReferencia = new Map<string, { numero: string; porcentaje: string }>();
        for (const par of modelo.comparacion?.pares ?? []) {
          const cambio = modelo.comparacion?.cambios[par.actual]?.[indice];
          if (cambio) cambiosPorReferencia.set(par.referencia, cambio);
        }
        for (const parametro of lista) {
          if (parametro.value === null || parametro.value === undefined || !parametro.seriesName) continue;
          const serie = porClave.get(parametro.seriesName);
          const cambio = cambiosPorReferencia.get(parametro.seriesName);
          const delta = cambio ? ` (${escapar(cambio.numero)}, ${escapar(cambio.porcentaje)})` : "";
          const unidad = serie ? unidadDeSerie(modelo, serie) : modelo.unidad;
          lineas.push(`${escapar(parametro.seriesName)}: ${escapar(serie?.textos[indice] ?? String(parametro.value))}${unidad ? ` ${escapar(unidad)}` : ""}${delta}`);
          for (const extra of serie?.extras?.[indice] ?? []) {
            lineas.push(`${escapar(extra.etiqueta)}: ${escapar(extra.texto)}`);
          }
        }
        if (modelo.pista) lineas.push(`<span style="opacity:.7">${escapar(modelo.pista)}</span>`);
        return lineas.join("<br>");
      },
    },
    xAxis: { type: "category", data: modelo.etiquetas, axisLabel: { color: colores.textoSecundario }, axisLine: { lineStyle: { color: colores.divisor } } },
    // Un eje es un objeto (lo que leen las gráficas de un solo eje); dos ejes, un arreglo: izquierda y derecha.
    ...(modelo.unidadSecundaria
      ? { yAxis: [ejeY(modelo.unidad, colores, true), ejeY(modelo.unidadSecundaria, colores, false)] }
      : { yAxis: ejeY(modelo.unidad, colores, true) }),
    ...(modelo.zoom ? { dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 4, borderColor: colores.divisor, textStyle: { color: colores.textoSecundario } }] } : {}),
    series: modelo.series.map((serie, i) => {
      // Claridad antes que adorno (criterio de HubSpot, 4-nov): UNA línea fuerte para lo que se mira y la
      // comparación en gris, sin segundo color; el valor escrito sobre cada punto cuando son pocos (si son
      // muchos, el tooltip y la tabla los dicen) y un relleno suave bajo la línea. Una serie con `color`
      // explícito conserva su color: así se distinguen dos pares en una misma gráfica.
      const comparacion = serie.punteada === true && serie.color === undefined;
      const color = comparacion ? colores.textoSecundario : colores.series[(serie.color ?? i) % colores.series.length];
      const ultimo = serie.valores.reduce<number>((u, valor, indice) => (valor === null ? u : indice), -1);
      const escribeTodas = modelo.dias.length <= ETIQUETAS_HASTA;
      const tipo = serie.tipo ?? modelo.tipo;
      const mixta = modelo.series.some((otra) => (otra.tipo ?? modelo.tipo) !== tipo);
      const barraSuave = tipo === "barra" && mixta && colores.relleno;
      return {
        name: serie.clave,
        type: tipo === "barra" ? "bar" : "line",
        yAxisIndex: modelo.unidadSecundaria ? (serie.eje ?? 0) : 0,
        data: serie.valores,
        cursor: serie.resumenes?.some(Boolean) ? "pointer" : "default",
        connectNulls: false,
        showSymbol: true,
        symbolSize: comparacion ? 4 : 6,
        itemStyle: barraSuave ? { color: colores.relleno, borderColor: color, borderWidth: 1 } : { color },
        lineStyle: { type: serie.punteada ? "dashed" : "solid", color, width: comparacion ? 1.5 : 2.5 },
        areaStyle: tipo === "linea" && !comparacion && !mixta ? { color, opacity: 0.08 } : undefined,
        // En una pantalla angosta los valores largos se pisan: ECharts oculta los que se traslapan.
        labelLayout: { hideOverlap: true },
        label: {
          // En una gráfica mixta los valores escritos de barras y líneas se pisan: viven en el tooltip y la tabla.
          show: !comparacion && !mixta,
          position: "top",
          color: colores.texto,
          formatter: (parametro: ParametroTooltip) =>
            escribeTodas || parametro.dataIndex === ultimo ? (serie.textos[parametro.dataIndex ?? 0] ?? "") : "",
        },
      };
    }),
  };
}

function ejeY(unidad: string, colores: ColoresDeGrafica, principal: boolean) {
  return {
    type: "value",
    name: unidad,
    position: principal ? "left" : "right",
    nameTextStyle: { color: colores.textoSecundario, align: principal ? "left" : "right" },
    min: (extremo: { min: number }) => Math.min(0, extremo.min),
    axisLabel: { color: colores.textoSecundario, formatter: abreviar },
    splitLine: principal ? { lineStyle: { color: colores.divisor, opacity: 0.5 } } : { show: false },
  };
}
