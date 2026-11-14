/**
 * Lo que toda Cifra del Hub dice igual, sea de la pestaña que sea (ticket 419, E-2): con qué filtros se calculó, el
 * periodo en palabras, la lista que abre y contra qué se compara. Los constructores de cada pestaña
 * (`cifras-de-comercial.ts`, `cifras-de-dinero.ts`) lo importan; ninguno lo vuelve a escribir.
 *
 * Módulo PURO.
 */
import { fechaCorta } from "@/lib/format";
import type { EntradaDeCifra } from "@/lib/metricas/cifra";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

export interface ContextoDelHub {
  programa: string;
  /** El código de la cohorte elegida, o `null` con "Todas". */
  cohorte: string | null;
  rango: { desde: string; hasta: string };
  hoy: string;
  /** El nombre del closer del filtro, o `null` con todos. */
  closer: string | null;
}

/** Las cinco primeras filas de una lista, ya escritas: las lee la página. */
export type FilasDeEvidencia = ReadonlyArray<ReadonlyArray<string>>;

type Lista = NonNullable<EntradaDeCifra["lista"]>;
type Comparacion = NonNullable<EntradaDeCifra["comparacion"]>;

/** El periodo como se lee en "Calculada con": "1-nov a hoy", o un solo día. */
export function periodoDelHub(rango: { desde: string; hasta: string }, hoy: string): string {
  const dia = (d: string) => (d === hoy ? "hoy" : fechaCorta(d));
  return rango.desde === rango.hasta ? dia(rango.desde) : `${fechaCorta(rango.desde)} a ${dia(rango.hasta)}`;
}

/** El periodo dentro de una frase: "…, del 1-nov a hoy." */
export function periodoEnPalabras(c: ContextoDelHub): string {
  const dia = (d: string) => (d === c.hoy ? "hoy" : `el ${fechaCorta(d)}`);
  return c.rango.desde === c.rango.hasta ? dia(c.rango.desde) : `del ${fechaCorta(c.rango.desde)} a ${dia(c.rango.hasta)}`;
}

/** Los chips de "Calculada con": Programa, Cohorte, Periodo y el closer solo si hay uno. */
export function filtrosDelHub(c: ContextoDelHub, closer: string | null = c.closer): Array<readonly [string, string]> {
  const filtros: Array<readonly [string, string]> = [
    ["Programa", c.programa],
    ["Cohorte", c.cohorte ?? "Todas"],
    ["Periodo", periodoDelHub(c.rango, c.hoy)],
  ];
  if (closer) filtros.push(["Closer", closer]);
  return filtros;
}

export function enCurso(c: ContextoDelHub): boolean {
  return c.rango.hasta >= c.hoy;
}

/** La lista de una cifra, solo si la sesión la puede abrir (con `sinListas` el detalle llega sin enlace). */
export function listaDeDetalle(
  detalle: DetalleDeCifra | null | undefined,
  filas: FilasDeEvidencia | undefined,
  forma: Pick<Lista, "nombre" | "articulo" | "parte">,
): Lista | undefined {
  if (!detalle || !detalle.href || !detalle.resumen.disponible) return undefined;
  return { href: detalle.href, total: detalle.resumen.subtotal.cantidad, filas: filas ?? [], ...forma };
}

/** Solo si se pidió comparar: sin referencia o sin el otro valor no hay comparación. */
export function comparacionCon(referencia: string | undefined, valor: number | null | undefined): Comparacion | undefined {
  return referencia === undefined || valor === undefined ? undefined : { referencia, valor };
}
