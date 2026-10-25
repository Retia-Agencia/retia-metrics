export interface SerieDeGrafica {
  clave: string;
  valores: Array<number | null>;
  punteada?: boolean;
  color?: number;
  enlaces?: Array<string | null>;
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
}

export interface ModeloDeGrafica {
  tipo: "linea" | "barra";
  unidad: string;
  dias: string[];
  etiquetas: string[];
  series: Array<SerieDeGrafica & { textos: Array<string | null> }>;
  meta?: { etiqueta: string; textos: Array<string | null> };
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
  const series = entrada.series.map((serie) => ({
    ...serie,
    textos: serie.valores.map((valor) => valor === null ? null : entrada.escribir(valor)),
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
        numero: `${signo(delta)}${entrada.escribir(Math.abs(delta))}`,
        porcentaje: b === 0 ? "—" : `${signo(delta)}${Math.round(Math.abs(delta / b) * 100)}%`,
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
  };
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
}

interface ParametroTooltip { seriesName?: string; dataIndex?: number; value?: number | null }

const escapar = (texto: string) => texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Único constructor de opciones ECharts: ejes lineales, cero visible y tooltip comparable. */
export function crearOpcionGrafica(modelo: ModeloDeGrafica, colores: ColoresDeGrafica) {
  const porClave = new Map(modelo.series.map((serie) => [serie.clave, serie]));
  return {
    animation: false,
    aria: { enabled: true, decal: { show: true } },
    color: colores.series,
    grid: { left: 12, right: 16, top: 36, bottom: 16, containLabel: true },
    legend: { top: 0, textStyle: { color: colores.texto } },
    tooltip: {
      trigger: "axis",
      backgroundColor: colores.fondo,
      borderColor: colores.divisor,
      textStyle: { color: colores.texto },
      formatter(parametros: ParametroTooltip | ParametroTooltip[]) {
        const lista = Array.isArray(parametros) ? parametros : [parametros];
        const indice = lista[0]?.dataIndex ?? 0;
        const lineas = [`<strong>${escapar(modelo.etiquetas[indice] ?? modelo.dias[indice] ?? "")}</strong>`];
        for (const parametro of lista) {
          if (parametro.value === null || parametro.value === undefined || !parametro.seriesName) continue;
          const serie = porClave.get(parametro.seriesName);
          lineas.push(`${escapar(parametro.seriesName)}: ${escapar(serie?.textos[indice] ?? String(parametro.value))} ${escapar(modelo.unidad)}`);
        }
        for (const par of modelo.comparacion?.pares ?? []) {
          const cambio = modelo.comparacion?.cambios[par.actual]?.[indice];
          if (!cambio) continue;
          lineas.push(`${escapar(par.actual)}: ${escapar(cambio.numero)} · ${escapar(cambio.porcentaje)}`);
        }
        return lineas.join("<br>");
      },
    },
    xAxis: { type: "category", data: modelo.etiquetas, axisLabel: { color: colores.textoSecundario }, axisLine: { lineStyle: { color: colores.divisor } } },
    yAxis: {
      type: "value",
      min: (extremo: { min: number }) => Math.min(0, extremo.min),
      max: (extremo: { max: number }) => Math.max(0, extremo.max),
      axisLabel: { color: colores.textoSecundario },
      splitLine: { lineStyle: { color: colores.divisor } },
    },
    series: modelo.series.map((serie, i) => ({
      name: serie.clave,
      type: modelo.tipo === "barra" ? "bar" : "line",
      data: serie.valores,
      connectNulls: false,
      showSymbol: true,
      symbolSize: 6,
      itemStyle: { color: colores.series[(serie.color ?? i) % colores.series.length] },
      lineStyle: { type: serie.punteada ? "dashed" : "solid" },
    })),
  };
}
