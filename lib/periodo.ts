import { z } from "zod";
import { aUtc, esFecha, resolverRango, sumarDias } from "@/lib/rangos";
import { diasHabilesEntre, esDiaHabil } from "@/lib/dias-habiles";
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

const esquema = z.object({
  periodo: z.enum([...Object.keys(atajosDePeriodo) as AtajoDePeriodo[], "custom"]).optional(),
  a_desde: fecha.optional(),
  a_hasta: fecha.optional(),
  b_desde: fecha.optional(),
  b_hasta: fecha.optional(),
  rango: z.enum(["hoy", "semana", "mes", "cohorte", "custom"]).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export interface EntradaDePeriodo {
  preset: AtajoDePeriodo | "custom";
  a?: Rango;
  b?: Rango;
  aviso?: string;
}

export interface PeriodoResuelto {
  preset: EntradaDePeriodo["preset"];
  a: Rango;
  b: Rango | null;
  aviso?: string;
}

/**
 * Valida el periodo en el borde para que una URL compartida no rompa la página.
 * Parámetros repetidos, fechas imposibles o pares incompletos caen a Hoy con aviso:
 * el selector debe decir lo que se está consultando, no repetir el valor inválido.
 *
 * Las claves nuevas prevalecen sobre las antiguas. En enlaces viejos, desde/hasta
 * solo cuentan con custom, igual que en resolverRango, para conservar su significado.
 */
export function parsearPeriodoUrl(url: Record<string, unknown>): EntradaDePeriodo {
  const invalido: EntradaDePeriodo = {
    preset: "hoy",
    aviso: "Periodo inválido: se muestra Hoy.",
  };
  const moderno = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta"].some(
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
    ? (p.periodo ?? (p.a_desde !== undefined || p.a_hasta !== undefined ? "custom" : "hoy"))
    : antiguo[p.rango ?? "hoy"];
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
  return {
    preset: a ? "custom" : preset,
    a,
    b,
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
 * B explícito se respeta. Si falta, se compara por hábiles contra el periodo previo.
 * Sin ventana de cohorte no se inventan fechas: A cae a Hoy con aviso o B queda
 * ausente, y el selector puede explicar por qué no hay comparación.
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
    if (!entrada.b) {
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
    }
  } else if (preset === "cohorte_actual" || preset === "cohorte_anterior") {
    const elegida = preset === "cohorte_actual" ? actual : anterior;
    if (!elegida || elegida.inicio > hoy) {
      return {
        ...resolverPeriodo({ preset: "hoy" }, contexto),
        aviso: "Sin ventana de venta disponible para esa cohorte: se muestra Hoy.",
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

  const b = entrada.b ?? (previo ? mismoPuntoHabil(a, previo) : null);
  return {
    preset,
    a,
    b,
    aviso: entrada.aviso ?? (b
      ? undefined
      : previo
        ? "Sin días hábiles comparables. Elige B manualmente."
        : "Sin cohorte anterior con ventana de venta. Elige B manualmente."),
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
  const periodo = resolverPeriodo({ ...entrada, b: undefined }, { hoy });
  const cayoAHoy = periodo.preset !== entrada.preset;
  return {
    campo: campo as C,
    periodo: { ...periodo, b: null, aviso: entrada.aviso ?? (cayoAHoy ? periodo.aviso : undefined) },
  };
}
