/**
 * La Cifra: una forma de métrica y su explicación, en todo el Hub (ticket 419, `docs/diseno-cifra-y-pauta.md` §1, §2, §10).
 *
 * `armarCifra` recibe los números que ya calculó la consulta y el texto del concepto, y devuelve `CifraDeMetrica`:
 * TODO lo que la tarjeta y su explicación muestran, ya escrito. Lo llama el servidor; la pantalla solo pinta, así la
 * cifra y su explicación no se pueden separar (DM-9) y ningún componente decide un vacío, un estado o un texto.
 *
 * Módulo PURO (sin `lib/db`): el contrato viaja como props a un componente cliente.
 */
import { cop, num, pct, usd } from "@/lib/format";
import type { FormaDeFormula } from "@/lib/metricas/registro";
import type { ExplicacionDeConcepto, UnidadDeCifra, UniversoDeCifra } from "@/lib/metricas/explicaciones-de-pauta";

export type { ExplicacionDeConcepto, UnidadDeCifra, UniversoDeCifra } from "@/lib/metricas/explicaciones-de-pauta";

export type TonoDeEstado = "exito" | "alerta" | "peligro";

/** DM-1: un solo vocabulario de estado en todo el CRM. */
export const ROTULO_DE_TONO: Record<TonoDeEstado, string> = {
  exito: "En meta",
  alerta: "En seguimiento",
  peligro: "Rezagado",
};

/** Umbrales de la escala de cantidad contra lo esperado a hoy (D-7). Los importa el cumplimiento de la cohorte. */
export const UMBRAL_EN_META = 1;
export const UMBRAL_EN_SEGUIMIENTO = 0.65;

/** El estado viene de una de dos fuentes; sin fuente no hay estado (nunca un gris inventado). */
export type FuenteDeEstado =
  | { fuente: "esperado"; llevamos: number; esperado: number }
  | {
    fuente: "objetivo"; objetivo: number; aceptable: number; menorEsMejor: boolean;
    /**
     * El tono ya decidido por el módulo dueño del concepto (el semáforo, que también colorea un costo sin agendas).
     * Con él, la Cifra no recalcula: la pantalla y el reporte de WhatsApp dicen lo mismo (N1).
     */
    tono?: TonoDeEstado;
  };

export interface AvanceDeEntrada {
  llevamos: number;
  meta: number;
  esperado: number;
  /** Fracción de días hábiles de venta de la cohorte transcurridos (0 a 1). */
  fraccionDeTiempo: number;
  /** De qué es la meta, en minúscula: "agendas", "ventas de pauta", "inversión". */
  de: string;
  /** De qué periodo es la meta. Por defecto "la cohorte"; en Hoy, "la semana". */
  ambito?: string;
  /** De dónde sale la meta, en una frase. Por defecto, que la cargan Pauta o Gerencia en Programa › Objetivos. */
  origenDeLaMeta?: string;
  /** Los días que mide `fraccionDeTiempo`. Por defecto "días hábiles de venta de la cohorte". */
  dias?: string;
}

/** Lo que entrega la consulta para una cifra concreta. Todo lo demás sale del concepto. */
export interface EntradaDeCifra {
  concepto: string;
  explicacion: ExplicacionDeConcepto;
  /** null = no se puede calcular; exige `motivo`. */
  valor: number | null;
  /** Por qué no hay valor, en palabras de negocio. Con `sinDatos`, por qué aún no hay periodo. */
  motivo?: string;
  /** La cohorte aún no abre la venta: "Sin datos" en vez de "—". */
  sinDatos?: boolean;
  partes?: readonly [number | null, number | null];
  /** El periodo en palabras para "Cómo leer la tarjeta": "cohorte C6 hasta hoy", "semana del 2 al 8 nov". */
  periodo?: string;
  /** Chips de "Calculada con", en orden. */
  filtros: ReadonlyArray<readonly [string, string]>;
  /** Cobertura parcial, con el motivo en palabras. */
  parcial?: string;
  enCurso?: boolean;
  /** Solo si se pidió comparar (o la columna anterior en una tabla). */
  comparacion?: { referencia: string; valor: number | null; etiqueta?: string };
  estado?: FuenteDeEstado;
  avance?: AvanceDeEntrada;
  /** Escribe el dinero en millones ("COP 15,6 M"); la comparación sigue el mismo formato. */
  enMillones?: boolean;
  /** La línea propia de la tarjeta: `antes` + cifra resaltada + `despues`. */
  linea?: { antes: string; cifra?: string; despues?: string };
  notas?: ReadonlyArray<readonly [string, string]>;
  /** La lista detrás de la cifra. Sin lista, la cifra no abre evidencia. */
  lista?: {
    href: string;
    nombre: string;
    total: number | null;
    filas: ReadonlyArray<ReadonlyArray<string>>;
    /** "los" o "las" delante del nombre ("Ver los 3 deals que asistieron"). Por defecto "las". */
    articulo?: "los" | "las";
    /** Qué lado de la fórmula es la lista en una razón. Por defecto el de abajo; "arriba" si es el numerador. */
    parte?: "arriba" | "abajo";
  };
}

export interface EstadoDeCifra {
  tono: TonoDeEstado;
  rotulo: string;
}

export interface FormulaEscrita {
  forma: FormaDeFormula;
  nombre: string;
  terminos: readonly string[];
  por1000: boolean;
  /** "Con los números de esta cifra: 403.200 ÷ 9 = COP 44.800", o null si faltan las partes. */
  conLosNumeros: string | null;
}

export interface BarraEscrita {
  /** 0 a 1. */
  lleno: number;
  /** El atraso rayado, de lo que llevamos a lo esperado (0 si vamos adelante). */
  atraso: number;
  /** Dónde va la marca de "a hoy" (0 a 1). */
  marca: number;
  rotuloDeMarca: string;
  /** "Vamos 146 atrás": la cifra va en mono. */
  lectura: { antes: string; cifra: string; despues: string };
}

/** El contrato que pinta la pantalla (diseño §10). Todo ya escrito. */
export interface CifraDeMetrica {
  concepto: string;
  rotulo: string;
  universo: UniversoDeCifra;
  textoDeUniverso: string;
  unidad: UnidadDeCifra;
  valor: number | null;
  /** El valor como se lee: "COP 44.800", "—", "0", "Sin datos". */
  textoDelValor: string;
  vacio: boolean;
  /** "de 900" junto al valor, si hay meta de cantidad. */
  deMeta: string | null;
  estado: EstadoDeCifra | null;
  barra: BarraEscrita | null;
  linea: { antes: string; cifra?: string; despues?: string } | null;
  comparacion: { texto: string; cifra: string; cambio: string } | null;
  etiquetas: readonly ("Parcial" | "En curso")[];
  ariaLabel: string;
  explicacion: {
    que: string;
    formula: FormulaEscrita;
    variables: ReadonlyArray<{ nombre: string; explicacion: string }>;
    aliasExcel: string | null;
    /** "Cómo leer la tarjeta": una fila por cada cosa visible, en orden. */
    lectura: ReadonlyArray<readonly [string, string]>;
    filtros: ReadonlyArray<readonly [string, string]>;
    evidencia: {
      href: string;
      /** `null` cuando la lista está vacía: no hay nada que abrir y la nota lo dice. */
      boton: string | null;
      filas: ReadonlyArray<ReadonlyArray<string>>;
      nota: string | null;
    } | null;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Formato

function millones(valor: number, moneda: "COP" | "USD"): string {
  return `${moneda} ${num(valor / 1_000_000, 1)} M`;
}

export function formatearValor(unidad: UnidadDeCifra, valor: number, enMillones = false): string {
  switch (unidad) {
    case "cop": return enMillones ? millones(valor, "COP") : cop(valor);
    case "usd": return enMillones ? millones(valor, "USD") : usd(valor);
    case "porcentaje": return pct(valor, 1);
    case "veces": return `${num(valor, 1)}×`;
    case "decimal": return num(valor, Number.isInteger(valor) ? 0 : 1);
    case "conteo": return num(Math.round(valor));
  }
}

function conSigno(delta: number, texto: string): string {
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${texto}`;
}

/** El cambio contra la referencia, en gris siempre (DM-2): cantidad y %, o puntos en una tasa. */
export function textoDeCambio(unidad: UnidadDeCifra, actual: number, anterior: number, enMillones = false): string {
  const delta = actual - anterior;
  if (unidad === "porcentaje") {
    const puntos = Math.abs(delta) * 100;
    return conSigno(delta, `${num(puntos, 1)} ${puntos === 1 ? "punto" : "puntos"}`);
  }
  const cantidad = formatearValor(unidad, Math.abs(delta), enMillones);
  const relativo = anterior === 0 ? "—" : conSigno(delta, `${num(Math.abs(delta / anterior) * 100, 0)} %`);
  return `${conSigno(delta, cantidad)} (${relativo})`;
}

// ---------------------------------------------------------------------------------------------------------------
// Estado

export function estadoDe(fuente: FuenteDeEstado, valor: number | null): { tono: TonoDeEstado; ratio: number | null } | null {
  if (fuente.fuente === "esperado") {
    if (fuente.esperado <= 0) return null;
    const ratio = fuente.llevamos / fuente.esperado;
    return { tono: ratio >= UMBRAL_EN_META ? "exito" : ratio >= UMBRAL_EN_SEGUIMIENTO ? "alerta" : "peligro", ratio };
  }
  if (fuente.tono) return { tono: fuente.tono, ratio: null };
  if (valor === null) return null;
  const cumple = fuente.menorEsMejor ? valor <= fuente.objetivo : valor >= fuente.objetivo;
  const acepta = fuente.menorEsMejor ? valor <= fuente.aceptable : valor >= fuente.aceptable;
  return { tono: cumple ? "exito" : acepta ? "alerta" : "peligro", ratio: null };
}

// ---------------------------------------------------------------------------------------------------------------
// Frases de los casos raros (diseño §1.3): una sola vez, aquí.

export const FRASE_NO_CALCULABLE = "«—» nunca significa cero.";
export const FRASE_CERO = "Es cero de verdad: se midió y no hubo ninguna.";
export const FRASE_SIN_DATOS = "Todavía no hay periodo que medir.";
export const FRASE_SIN_OBJETIVO = "Esta cohorte no tiene objetivo cargado para esta métrica, así que no hay estado. Se carga en Programa › Objetivos.";
export const FRASE_CAMBIO_EN_GRIS = "Va en gris porque subir no siempre es bueno; el color solo lo pone el estado.";
export const FRASE_PUNTOS = "En una tasa el cambio va en puntos: de 40 % a 42 % son 2 puntos.";

export function fraseEnCurso(periodo: string | undefined): string {
  const sujeto = periodo ? periodo.charAt(0).toUpperCase() + periodo.slice(1) : "Este periodo";
  return `${sujeto} todavía no termina: las cifras pueden subir y las tasas cambiar hasta que cierre.`;
}

const UNIVERSO: Record<UniversoDeCifra, { corto: string; explicacion: string }> = {
  pauta: { corto: "de pauta", explicacion: "Solo personas o gasto que vienen de anuncios pagos." },
  todas: { corto: "todas las áreas", explicacion: "Pauta, orgánico, referidos y registros sin origen, juntos." },
};

const OPERADOR: Record<FormaDeFormula, string> = { razon: "÷", resta: "−", producto: "×", suma: "", conteo: "" };

function sinPuntoFinal(texto: string): string {
  return texto.replace(/\.$/, "");
}

// ---------------------------------------------------------------------------------------------------------------

export function armarCifra(e: EntradaDeCifra): CifraDeMetrica {
  const x = e.explicacion;
  const fmt = (v: number) => formatearValor(x.unidad, v, e.enMillones);
  // Lo esperado a hoy casi nunca es entero: en una meta de cantidad se escribe con su decimal ("a hoy 34,1").
  const fmtAvance = (v: number) => formatearValor(x.unidad === "conteo" ? "decimal" : x.unidad, v, e.enMillones);
  const vacio = e.valor === null;
  if (vacio && !e.motivo) throw new Error(`La cifra ${e.concepto} no tiene valor ni motivo: "—" siempre dice por qué.`);

  const textoDelValor = e.sinDatos ? "Sin datos" : e.valor === null ? "—" : fmt(e.valor);
  const calculado = e.estado ? estadoDe(e.estado, e.valor) : null;
  const estado = calculado ? { tono: calculado.tono, rotulo: ROTULO_DE_TONO[calculado.tono] } : null;
  const a = e.avance;

  const barra: BarraEscrita | null = a && a.meta > 0
    ? (() => {
      const lleno = Math.min(1, Math.max(0, a.llevamos / a.meta));
      const marca = Math.min(1, Math.max(0, a.esperado / a.meta));
      const desfase = a.esperado - a.llevamos;
      return {
        lleno,
        marca,
        atraso: Math.max(0, marca - lleno),
        rotuloDeMarca: `a hoy ${fmtAvance(a.esperado)}`,
        lectura: desfase > 0
          ? { antes: "Vamos ", cifra: fmtAvance(desfase), despues: " atrás" }
          : { antes: "Vamos ", cifra: fmtAvance(-desfase), despues: " adelante" },
      };
    })()
    : null;

  const comparacion = e.comparacion && e.comparacion.valor !== null && e.valor !== null
    ? {
      texto: e.comparacion.referencia,
      cifra: fmt(e.comparacion.valor),
      cambio: textoDeCambio(x.unidad, e.valor, e.comparacion.valor, e.enMillones),
    }
    : null;

  const etiquetas: ("Parcial" | "En curso")[] = [];
  if (e.parcial) etiquetas.push("Parcial");
  if (e.enCurso) etiquetas.push("En curso");

  // Cómo leer la tarjeta: una fila por cada cosa visible, en el orden en que aparece (diseño §2 punto 3).
  const lectura: [string, string][] = [];
  if (e.sinDatos) lectura.push(["Sin datos", `${e.motivo ? `${sinPuntoFinal(e.motivo)}. ` : ""}${FRASE_SIN_DATOS}`]);
  else if (e.valor === null) lectura.push(["—", `No se puede calcular. ${sinPuntoFinal(e.motivo!)}. ${FRASE_NO_CALCULABLE}`]);
  else if (e.valor === 0) lectura.push(["0", FRASE_CERO]);
  else lectura.push([textoDelValor, `${sinPuntoFinal(x.que)}${e.periodo ? `, ${e.periodo}` : ""}.`]);
  lectura.push([UNIVERSO[x.universo].corto, UNIVERSO[x.universo].explicacion]);
  if (a && barra) {
    const tiempo = num(a.fraccionDeTiempo * 100, 0);
    lectura.push([`de ${fmtAvance(a.meta)}`, `La meta de ${a.de} de ${a.ambito ?? "la cohorte"}. ${a.origenDeLaMeta ?? "La cargan Pauta o Gerencia en Programa › Objetivos."}`]);
    lectura.push([barra.rotuloDeMarca, `Lo que deberíamos llevar si avanzáramos parejo: ${fmtAvance(a.meta)} × ${tiempo} %, porque ya pasó el ${tiempo} % de los ${a.dias ?? "días hábiles de venta de la cohorte"}. Es la marca sobre la barra.`]);
    const desfase = a.esperado - a.llevamos;
    lectura.push(desfase > 0
      ? [`${fmtAvance(desfase)} atrás`, `${fmtAvance(a.esperado)} − ${fmtAvance(a.llevamos)}. Es lo rayado en la barra.`]
      : [`${fmtAvance(-desfase)} adelante`, "Ya vamos por encima de lo esperado a hoy."]);
  }
  if (estado && e.estado && calculado) {
    if (e.estado.fuente === "esperado") {
      lectura.push([estado.rotulo, `Llevamos ${num((calculado.ratio ?? 0) * 100, 0)} % de lo esperado a hoy. En meta desde 100 %, en seguimiento desde 65 %, rezagado por debajo.`]);
    } else {
      const { objetivo, aceptable, menorEsMejor } = e.estado;
      const sentido = menorEsMejor ? "o menos" : "o más";
      const donde = estado.tono === "exito" ? "Esta cifra cumple el objetivo."
        : estado.tono === "alerta" ? "Esta cifra queda entre los dos." : "Esta cifra es peor que lo aceptable.";
      lectura.push([estado.rotulo, `El objetivo es ${fmt(objetivo)} ${sentido} y lo aceptable ${fmt(aceptable)} ${sentido}. ${donde} Los cargan Pauta o Gerencia en Programa › Objetivos.`]);
    }
  } else if (x.admiteObjetivo && e.valor !== null) {
    lectura.push(["Sin color", FRASE_SIN_OBJETIVO]);
  }
  if (comparacion && e.comparacion) {
    lectura.push([
      e.comparacion.etiqueta ?? "Cambio",
      `Comparado con ${e.comparacion.referencia} (${comparacion.cifra}): ${comparacion.cambio}.${x.unidad === "porcentaje" ? ` ${FRASE_PUNTOS}` : ""} ${FRASE_CAMBIO_EN_GRIS}`,
    ]);
  }
  if (e.parcial) lectura.push(["Parcial", e.parcial]);
  if (e.enCurso) lectura.push(["En curso", fraseEnCurso(e.periodo)]);
  for (const nota of e.notas ?? []) lectura.push([nota[0], nota[1]]);

  const [p0, p1] = e.partes ?? [null, null];
  const unidades = x.unidadesDePartes ?? ["conteo", "conteo"];
  const operador = OPERADOR[x.formula.forma];
  const conLosNumeros = operador && p0 !== null && p1 !== null && e.valor !== null
    ? `Con los números de esta cifra: ${formatearValor(unidades[0], p0)} ${operador} ${formatearValor(unidades[1], p1)}${x.formula.por1000 ? " × 1.000" : ""} = ${fmt(e.valor)}`
    : null;

  const l = e.lista;
  const esRazonDeConteo = x.formula.forma === "razon" && unidades[1] === "conteo";
  const evidencia = l && l.total === 0
    ? { href: l.href, boton: null, filas: [], nota: `Todavía no hay ${l.nombre}.` }
    : l
    ? {
      href: l.href,
      boton: l.total !== null ? `Ver ${l.articulo ?? "las"} ${num(l.total)} ${l.nombre}` : `Ver ${l.articulo === "los" ? "todos los" : "todas las"} ${l.nombre}`,
      filas: l.filas.slice(0, 5),
      nota: !esRazonDeConteo ? null
        : l.parte === "arriba"
        ? `Son ${l.articulo ?? "las"} ${l.nombre} de arriba de la fórmula.`
        : `Son ${l.articulo ?? "las"} ${l.nombre} de abajo de la fórmula${unidades[0] === "conteo" ? "; la última columna dice cuáles suman arriba" : ""}.`,
    }
    : null;

  return {
    concepto: e.concepto,
    rotulo: x.rotulo,
    universo: x.universo,
    textoDeUniverso: UNIVERSO[x.universo].corto,
    unidad: x.unidad,
    valor: e.valor,
    textoDelValor,
    vacio: e.valor === null,
    deMeta: a ? `de ${fmtAvance(a.meta)}` : null,
    estado,
    barra,
    linea: e.linea ?? null,
    comparacion,
    etiquetas,
    ariaLabel: `${x.rotulo}: ${textoDelValor}${a ? ` de ${fmtAvance(a.meta)}` : ""}. Abrir cómo se calcula`,
    explicacion: {
      que: x.que,
      formula: { forma: x.formula.forma, nombre: x.rotulo, terminos: x.formula.terminos, por1000: Boolean(x.formula.por1000), conLosNumeros },
      variables: x.variables,
      aliasExcel: x.aliasExcel ?? null,
      lectura,
      filtros: e.filtros,
      evidencia,
    },
  };
}
