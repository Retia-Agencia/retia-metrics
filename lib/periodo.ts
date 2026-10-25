import { z } from "zod";
import { aUtc, esFecha, resolverRango, sumarDias } from "@/lib/rangos";
import { diasHabilesEntre, esDiaHabil } from "@/lib/dias-habiles";
import { fecha as formatearFecha } from "@/lib/format";
import type { Rango } from "@/lib/queries/dashboard";

export const atajosDePeriodo = {
  hoy: "Hoy",
  ayer: "Ayer",
  manana: "Mañana",
  esta_semana: "Esta semana",
  semana_pasada: "Semana pasada",
  este_mes: "Este mes",
  mes_pasado: "Mes pasado",
  cohorte_actual: "Cohorte actual",
  cohorte_anterior: "Cohorte anterior",
} as const;

export type AtajoDePeriodo = keyof typeof atajosDePeriodo;
/**
 * Lo que se pide comparar (ADR 0106): el mismo punto del periodo anterior, la cohorte anterior o
 * un rango elegido. Es lo que vive en la URL; el rango real lo decide `resolverPeriodo`.
 */
export type PedidoDeComparacion =
  | { tipo: "anterior" }
  | { tipo: "cohorte" }
  | { tipo: "rango"; rango: Rango };

/** Tope de comparaciones a la vez: cada una es otra corrida de consultas (ADR 0106). */
export const MAXIMO_DE_COMPARACIONES = 3;

interface Ventana {
  inicio: string;
  cierre: string;
}

interface ContextoDePeriodo {
  hoy: string;
  actual?: Ventana | null;
  anterior?: Ventana | null;
  anteAnterior?: Ventana | null;
}

const fecha = z.string().refine(esFecha);
const rango = z.object({
  desde: fecha,
  hasta: fecha,
}).refine((r) => r.desde <= r.hasta);

const RANGO_EN_URL = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;

/** Un elemento de `?comparar=`: `anterior`, `cohorte` o `AAAA-MM-DD_AAAA-MM-DD`. */
const pedidoEnUrl = z.string().transform((texto, ctx): PedidoDeComparacion => {
  if (texto === "anterior" || texto === "cohorte") return { tipo: texto };
  const partes = RANGO_EN_URL.exec(texto);
  const par = partes ? rango.safeParse({ desde: partes[1], hasta: partes[2] }) : null;
  if (par?.success) return { tipo: "rango", rango: par.data };
  ctx.addIssue({ code: "custom", message: "Comparación inválida" });
  return z.NEVER;
});

/** `comparar=no` es la forma vieja de "ninguna"; el resto es la lista nueva separada por comas. */
const listaDeComparar = z.string().transform((texto, ctx) => {
  if (texto === "no") return [];
  const lista: PedidoDeComparacion[] = [];
  for (const parte of texto.split(",")) {
    const pedido = pedidoEnUrl.safeParse(parte);
    if (!pedido.success) {
      ctx.addIssue({ code: "custom", message: "Comparación inválida" });
      return z.NEVER;
    }
    lista.push(pedido.data);
  }
  return lista;
});

const esquema = z.object({
  periodo: z.enum([...Object.keys(atajosDePeriodo) as AtajoDePeriodo[], "custom"]).optional(),
  a_desde: fecha.optional(),
  a_hasta: fecha.optional(),
  b_desde: fecha.optional(),
  b_hasta: fecha.optional(),
  comparar: listaDeComparar.optional(),
  rango: z.enum(["hoy", "semana", "mes", "cohorte", "custom"]).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export interface EntradaDePeriodo {
  preset: AtajoDePeriodo | "custom";
  a?: Rango;
  /** El atajo salió del valor por defecto de la pantalla (ADR 0106, A-168). */
  predeterminado?: true;
  /**
   * La lista de lo que se compara; si viene, manda sola. La URL siempre la trae (vacía = sin
   * comparación, ADR 0106). Sin ella rige la forma vieja, la que usan los llamadores de código
   * que arman su propio periodo (la gráfica de deals contra agendas, las series de dinero):
   * `b` explícito, `comparar` o, sin nada, el mismo punto del periodo anterior.
   * ponytail: cuando esas pantallas pasen a N comparaciones, que pidan `comparaciones` explícito
   * y este respaldo se borra.
   */
  comparaciones?: PedidoDeComparacion[];
  b?: Rango;
  comparar?: "no" | "cohorte";
  aviso?: string;
}

/** Una comparación ya resuelta a fechas. Las que no se pudieron resolver no están: lo dice el aviso. */
export interface ComparacionResuelta {
  pedido: PedidoDeComparacion;
  rango: Rango;
}

export interface PeriodoResuelto {
  preset: EntradaDePeriodo["preset"];
  a: Rango;
  /** La primera comparación o null: lo que leen las pantallas de un solo B (ADR 0106). */
  b: Rango | null;
  /** Todas las comparaciones resueltas, en el orden pedido. Ausente equivale a `[b]` o `[]`. */
  comparaciones?: ComparacionResuelta[];
  aviso?: string;
}

/** Las comparaciones de un periodo, también de uno armado a mano con solo `b`. */
export function comparacionesDe(periodo: PeriodoResuelto): ComparacionResuelta[] {
  if (periodo.comparaciones) return periodo.comparaciones;
  return periodo.b ? [{ pedido: { tipo: "rango", rango: periodo.b }, rango: periodo.b }] : [];
}

/** La identidad de un pedido: dos iguales en la URL son uno solo. */
export function claveDePedido(pedido: PedidoDeComparacion): string {
  return pedido.tipo === "rango" ? `${pedido.rango.desde}_${pedido.rango.hasta}` : pedido.tipo;
}

function sinRepetidos(pedidos: PedidoDeComparacion[]): PedidoDeComparacion[] {
  const vistos = new Set<string>();
  return pedidos.filter((pedido) => {
    const clave = claveDePedido(pedido);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** El valor de `?comparar=` para una lista de pedidos; vacía es null, que es "sin comparación". */
export function parametrosDeComparaciones(
  pedidos: PedidoDeComparacion[],
): Record<"comparar" | "b_desde" | "b_hasta", string | null> {
  const lista = sinRepetidos(pedidos).slice(0, MAXIMO_DE_COMPARACIONES);
  return {
    comparar: lista.length ? lista.map(claveDePedido).join(",") : null,
    // Las claves viejas se limpian siempre: una vez editada, la URL queda en la forma nueva.
    b_desde: null,
    b_hasta: null,
  };
}

const legibleRango = (r: Rango) => r.desde === r.hasta
  ? formatearFecha(r.desde)
  : `${formatearFecha(r.desde)} a ${formatearFecha(r.hasta)}`;

/** El nombre corto de un pedido, el del chip: "Cohorte anterior", "1 sep 2026 a 9 sep 2026". */
export function nombreDePedido(pedido: PedidoDeComparacion, preset: EntradaDePeriodo["preset"]): string {
  if (pedido.tipo === "rango") return legibleRango(pedido.rango);
  if (pedido.tipo === "cohorte" || preset === "cohorte_actual" || preset === "cohorte_anterior") return "Cohorte anterior";
  return "Periodo anterior";
}

/** Describe en palabras la base que acompaña a una variación: la de la primera comparación. */
export function descripcionDeComparacion(periodo: PeriodoResuelto): string {
  const [primera] = comparacionesDe(periodo);
  if (!primera) return "sin comparación";
  if (primera.pedido.tipo !== "rango") {
    const nombre = nombreDePedido(primera.pedido, periodo.preset).toLowerCase();
    return `contra ${nombre === "cohorte anterior" ? "la" : "el"} ${nombre} al mismo día hábil`;
  }
  return `contra ${legibleRango(primera.rango)}`;
}

interface OpcionesDeUrl {
  /** El atajo cuando la URL no dice ninguno. El Hub de un programa abre en la cohorte (ADR 0106). */
  porDefecto?: AtajoDePeriodo;
}

/**
 * Valida el periodo en el borde para que una URL compartida no rompa la página.
 * Parámetros repetidos, fechas imposibles o pares incompletos caen a Hoy con aviso:
 * el selector debe decir lo que se está consultando, no repetir el valor inválido.
 *
 * Las claves nuevas prevalecen sobre las antiguas. En enlaces viejos, desde/hasta
 * solo cuentan con custom, igual que en resolverRango, para conservar su significado.
 * Las comparaciones salen de `comparar` y, en URLs viejas, de `b_desde`/`b_hasta`, que va primero.
 */
export function parsearPeriodoUrl(url: Record<string, unknown>, opciones: OpcionesDeUrl = {}): EntradaDePeriodo {
  const invalido: EntradaDePeriodo = {
    preset: "hoy",
    comparaciones: [],
    aviso: "Periodo inválido: se muestra Hoy.",
  };
  const porDefecto = opciones.porDefecto ?? "hoy";
  const moderno = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta", "comparar"].some(
    (clave) => url[clave] !== undefined,
  );
  const entrada = { ...url };
  if (moderno) delete entrada.rango;
  if (moderno || entrada.rango !== "custom") {
    delete entrada.desde;
    delete entrada.hasta;
  }

  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) return invalido;

  const p = resultado.data;
  const antiguo = {
    hoy: "hoy",
    semana: "esta_semana",
    mes: "este_mes",
    cohorte: "cohorte_actual",
    custom: "custom",
  } as const;
  const preset = moderno
    ? (p.periodo ?? (p.a_desde !== undefined || p.a_hasta !== undefined ? "custom" : porDefecto))
    : p.rango ? antiguo[p.rango] : porDefecto;
  const predeterminado = moderno
    ? p.periodo === undefined && p.a_desde === undefined && p.a_hasta === undefined
    : p.rango === undefined;
  const desde = moderno ? p.a_desde : preset === "custom" ? p.desde : undefined;
  const hasta = moderno ? p.a_hasta : preset === "custom" ? p.hasta : undefined;

  let a: Rango | undefined;
  if (preset === "custom" || desde !== undefined || hasta !== undefined) {
    const par = rango.safeParse({ desde, hasta });
    if (!par.success) return invalido;
    a = par.data;
  }

  let b: Rango | undefined;
  if (p.b_desde !== undefined || p.b_hasta !== undefined) {
    const par = rango.safeParse({
      desde: p.b_desde,
      hasta: p.b_hasta,
    });
    if (!par.success) return invalido;
    b = par.data;
  }
  const comparaciones = sinRepetidos([
    ...(b ? [{ tipo: "rango" as const, rango: b }] : []),
    ...(p.comparar ?? []),
  ]);
  if (comparaciones.length > MAXIMO_DE_COMPARACIONES) return invalido;
  return {
    preset: a ? "custom" : preset,
    a,
    comparaciones,
    b,
    predeterminado: predeterminado ? true : undefined,
  };
}

function mesAnterior(desde: string): Rango {
  const hasta = sumarDias(`${desde.slice(0, 7)}-01`, -1);
  return {
    desde: `${hasta.slice(0, 7)}-01`,
    hasta,
  };
}

interface BusquedaDeDiaHabil {
  ancla: string;
  cantidad: number;
  direccion: "adelante" | "atras";
  limiteEnDias: number;
}

/**
 * Encuentra el primer desplazamiento que completa la cantidad de hábiles, contando
 * el ancla. La dirección solo cambia los extremos que recibe diasHabilesEntre:
 * la definición de hábil sigue en un único lugar, también al buscar hacia atrás.
 * Si no se alcanza la cantidad, devuelve el límite para no salir de la ventana.
 */
function diaQueCompletaHabiles({
  ancla,
  cantidad,
  direccion,
  limiteEnDias,
}: BusquedaDeDiaHabil): string {
  const signo = direccion === "adelante" ? 1 : -1;
  let izquierda = 0;
  let derecha = limiteEnDias;

  while (izquierda < derecha) {
    const medio = Math.floor((izquierda + derecha) / 2);
    const dia = sumarDias(ancla, signo * medio);
    const habiles = direccion === "adelante"
      ? diasHabilesEntre(ancla, dia)
      : diasHabilesEntre(dia, ancla);

    if (habiles >= cantidad) derecha = medio;
    else izquierda = medio + 1;
  }

  return sumarDias(ancla, signo * izquierda);
}

/**
 * Corta B al mismo número de hábiles de A: comparar un mes parcial con todo el
 * anterior exageraría la variación (ADR 0067). El cierre anterior es el tope,
 * aunque no alcance los hábiles de A. Sin hábiles devuelve null, no un rango ficticio.
 */
export function mismoPuntoHabil(a: Rango, anterior: Rango): Rango | null {
  const n = diasHabilesEntre(a.desde, a.hasta);
  if (n === 0 || diasHabilesEntre(anterior.desde, anterior.hasta) === 0) return null;

  return {
    desde: anterior.desde,
    hasta: diaQueCompletaHabiles({
      ancla: anterior.desde,
      cantidad: n,
      direccion: "adelante",
      limiteEnDias: (aUtc(anterior.hasta) - aUtc(anterior.desde)) / 86_400_000,
    }),
  };
}

/**
 * Resuelve A y B sin reloj ni base para que servidor y tests usen la misma regla.
 * Hoy ya viene calculado en Bogotá; las ventanas pertenecen al mismo programa.
 *
 * Solo se compara lo que se pidió (ADR 0106): un rango se respeta tal cual; "anterior" y
 * "cohorte" se cortan por hábiles contra su periodo previo. Sin ventana de cohorte no se
 * inventan fechas: A cae a Hoy con aviso o esa comparación falta y el aviso dice por qué.
 */
export function resolverPeriodo(
  entrada: EntradaDePeriodo,
  contexto: ContextoDePeriodo,
): PeriodoResuelto {
  const { hoy, actual, anterior, anteAnterior } = contexto;
  const { preset } = entrada;
  let a: Rango;
  let previo: Rango | null = null;
  const ventana = (v: Ventana): Rango => ({
    desde: v.inicio,
    hasta: v.cierre,
  });

  if (preset === "custom" && entrada.a) {
    a = entrada.a;
    // Rango libre: retroceder tantos hábiles como A desde el día anterior.
    const n = diasHabilesEntre(a.desde, a.hasta);
    const hasta = sumarDias(a.desde, -1);
    previo = {
      desde: diaQueCompletaHabiles({
        ancla: hasta,
        cantidad: n,
        direccion: "atras",
        // Solo se excluyen fines de semana: esta cota contiene n hábiles.
        limiteEnDias: Math.ceil(n / 5) * 7 + 7,
      }),
      hasta,
    };
  } else if (preset === "cohorte_actual" || preset === "cohorte_anterior") {
    const elegida = preset === "cohorte_actual" ? actual : anterior;
    if (!elegida || elegida.inicio > hoy) {
      const reemplazo = entrada.predeterminado ? "este_mes" : "hoy";
      return {
        ...resolverPeriodo({ ...entrada, preset: reemplazo, a: undefined, aviso: undefined, predeterminado: undefined }, contexto),
        aviso: entrada.predeterminado
          ? "Sin cohorte en curso: se muestra Este mes."
          : "Sin ventana de venta disponible para esa cohorte: se muestra Hoy.",
      };
    }
    a = resolverRango({ preset: "cohorte", hoy, ventana: elegida }).rango;
    const previa = preset === "cohorte_actual" ? anterior : anteAnterior;
    previo = previa ? ventana(previa) : null;
  } else if (preset === "este_mes" || preset === "mes_pasado") {
    a = preset === "este_mes"
      ? resolverRango({ preset: "mes", hoy }).rango
      : mesAnterior(hoy);
    previo = mesAnterior(a.desde);
  } else if (preset === "esta_semana" || preset === "semana_pasada") {
    const semana = resolverRango({ preset: "semana", hoy }).rango;
    a = preset === "esta_semana"
      ? semana
      : {
          desde: sumarDias(semana.desde, -7),
          hasta: sumarDias(semana.desde, -1),
        };
    previo = {
      desde: sumarDias(a.desde, -7),
      hasta: sumarDias(a.desde, -1),
    };
  } else {
    const dia = sumarDias(hoy, preset === "ayer" ? -1 : preset === "manana" ? 1 : 0);
    a = resolverRango({ preset: "hoy", hoy: dia }).rango;
    let anteriorHabil = sumarDias(dia, -1);
    while (!esDiaHabil(anteriorHabil)) {
      anteriorHabil = sumarDias(anteriorHabil, -1);
    }
    previo = {
      desde: anteriorHabil,
      hasta: anteriorHabil,
    };
  }

  const pedidos: PedidoDeComparacion[] = entrada.comparaciones ?? (
    entrada.b ? [{ tipo: "rango", rango: entrada.b }]
      : entrada.comparar === "no" ? []
      : [{ tipo: entrada.comparar === "cohorte" ? "cohorte" : "anterior" }]
  );
  const esCohorte = preset === "cohorte_actual" || preset === "cohorte_anterior";
  const avisos: string[] = [];
  const comparaciones: ComparacionResuelta[] = [];
  for (const pedido of pedidos) {
    if (pedido.tipo === "rango") {
      comparaciones.push({ pedido, rango: pedido.rango });
      continue;
    }
    // En un atajo de cohorte, el periodo anterior ES la cohorte anterior.
    const base = pedido.tipo === "cohorte" && !esCohorte ? (anterior ? ventana(anterior) : null) : previo;
    const resuelto = base ? mismoPuntoHabil(a, base) : null;
    if (resuelto) comparaciones.push({ pedido, rango: resuelto });
    else avisos.push(base
      ? "Sin días hábiles comparables. Elige un rango para comparar."
      : "Sin cohorte anterior con ventana de venta. Elige un rango para comparar.");
  }
  return {
    preset,
    a,
    b: comparaciones[0]?.rango ?? null,
    comparaciones,
    aviso: entrada.aviso ?? ([...new Set(avisos)].join(" ") || undefined),
  };
}

/** El filtro de fecha de una lista (ticket 141): QUÉ fecha y el periodo A del selector, sin B. */
export interface FiltroDeFecha<C extends string> {
  campo: C;
  /** `b` siempre es `null`: una lista filtra, no compara. */
  periodo: PeriodoResuelto;
}

/**
 * Lee el filtro de fecha de una lista desde la URL: `fecha` dice sobre qué campo y el resto son
 * las claves del selector (136). Sin `fecha`, o con un campo que la lista no tiene, no hay
 * filtro: una lista sin parámetros muestra todo, no "Hoy". `hoy` viene de `hoyEnBogota()`.
 *
 * Las listas no tienen ventana de cohorte: un atajo de cohorte cae a Hoy con su aviso, igual
 * que una URL inválida. Los avisos que hablan de B se callan, porque aquí no hay B.
 */
export function filtroDeFechaDeLaUrl<C extends string>(
  url: Record<string, unknown>,
  campos: readonly C[],
  hoy: string,
): FiltroDeFecha<C> | null {
  const campo = url.fecha;
  if (typeof campo !== "string" || !(campos as readonly string[]).includes(campo)) return null;
  const entrada = parsearPeriodoUrl(url);
  const periodo = resolverPeriodo({ ...entrada, comparaciones: [] }, { hoy });
  const cayoAHoy = periodo.preset !== entrada.preset;
  return {
    campo: campo as C,
    periodo: { ...periodo, b: null, comparaciones: [], aviso: entrada.aviso ?? (cayoAHoy ? periodo.aviso : undefined) },
  };
}
