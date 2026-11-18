/**
 * `/hub` (todos los programas) como Cifras (ticket 419, fase E-4).
 *
 * Recibe lo que la página YA consultó (`VistaDeTodos`) y lo vuelve `CifraDeMetrica`. No consulta ni recalcula.
 * Dos reglas del ADR 0048 viven aquí como forma:
 * - Lo que se suma entre programas (conteos, dinero en una misma moneda) es UNA Cifra de total, y su nota dice que es
 *   la suma de los programas que la persona ve.
 * - Las tasas nunca se combinan: cada programa tiene su Cifra, con el nombre del programa en «Calculada con».
 *
 * Módulo PURO (solo importa tipos de `lib/queries/`).
 */
import {
  cifraDeAsistencia, cifraDeCierreDeVentas, type PartesDelGrupo,
} from "@/lib/hub/cifras-de-comercial";
import {
  comparacionCon, enCurso, filtrosDelHub, listaDeDetalle, periodoEnPalabras, type ContextoDelHub,
} from "@/lib/hub/contexto-de-cifras";
import { armarCifra, type CifraDeMetrica, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { FilaDePrograma, VistaDeTodos } from "@/lib/queries/vista-todos";

export const CONCEPTOS_DE_CONTEOS_DE_TODOS = ["leads", "citas", "shows", "ventas"] as const;
export type ConceptoDeConteoDeTodos = (typeof CONCEPTOS_DE_CONTEOS_DE_TODOS)[number];
export type ExplicacionesDeConteosDeTodos = Record<ConceptoDeConteoDeTodos, ExplicacionDeConcepto>;

export const NOMBRE_DE_TODOS = "Todos los programas";
const NOTA_DE_SUMA: readonly [string, string] = [
  "Suma de programas",
  "Es la suma de cada programa que ves, cada uno con su propio cálculo. Las tasas no se suman: van por programa.",
];

/** Una Cifra de `cifrasDeDinero` (que no conoce «todos») dice, en «Cómo leer la tarjeta», que es una suma. */
export function conNotaDeSuma(cifra: CifraDeMetrica): CifraDeMetrica {
  return { ...cifra, explicacion: { ...cifra.explicacion, lectura: [...cifra.explicacion.lectura, NOTA_DE_SUMA] } };
}

type Campo ="leads" | "agendas" | "shows" | "cierres";
const CAMPO: Record<ConceptoDeConteoDeTodos, { campo: Campo; lista: Campo; nombre: string }> = {
  leads: { campo: "leads", lista: "leads", nombre: "personas" },
  citas: { campo: "agendas", lista: "agendas", nombre: "citas" },
  shows: { campo: "shows", lista: "shows", nombre: "citas realizadas" },
  ventas: { campo: "cierres", lista: "cierres", nombre: "ventas" },
};

/** El contexto de los totales: nunca una cohorte ni un closer, porque `/hub` no los filtra. */
export function contextoDeTodos(vista: Pick<VistaDeTodos, "periodo">, hoy: string): ContextoDelHub {
  return { programa: NOMBRE_DE_TODOS, cohorte: null, rango: vista.periodo.a, hoy, closer: null };
}

/** Leads, Citas, Realizadas y Ventas: conteos sumables, una Cifra de total cada uno. */
export function cifrasDeConteosDeTodos(e: {
  vista: Pick<VistaDeTodos, "a" | "b" | "detalles">;
  referencia?: string;
  explicaciones: ExplicacionesDeConteosDeTodos;
  contexto: ContextoDelHub;
  conceptos?: readonly ConceptoDeConteoDeTodos[];
}): CifraDeMetrica[] {
  const { vista, contexto: c } = e;
  return (e.conceptos ?? CONCEPTOS_DE_CONTEOS_DE_TODOS).map((concepto) => {
    const { campo, lista, nombre } = CAMPO[concepto];
    return armarCifra({
      concepto,
      explicacion: e.explicaciones[concepto],
      valor: vista.a[campo].valor,
      comparacion: comparacionCon(vista.b ? e.referencia : undefined, vista.b?.[campo].valor),
      lista: listaDeDetalle(vista.detalles[lista], undefined, { nombre, articulo: "las" }),
      filtros: filtrosDelHub(c),
      periodo: periodoEnPalabras(c),
      enCurso: enCurso(c),
      notas: [NOTA_DE_SUMA],
    });
  });
}

/** Asistencia y Cierre de ventas de UN programa: la tasa de cada uno, nunca combinada. */
export function cifrasDeTasasDeUnPrograma(e: {
  fila: Pick<FilaDePrograma, "programa" | "dashboard">;
  referencia?: string;
  explicaciones: { asistencia: ExplicacionDeConcepto; cierre_de_ventas: ExplicacionDeConcepto };
  contexto: ContextoDelHub;
}): { asistencia: CifraDeMetrica; cierreDeVentas: CifraDeMetrica } {
  const c: ContextoDelHub = { ...e.contexto, programa: e.fila.programa.nombre, cohorte: null };
  const partes: PartesDelGrupo = {
    embudo: e.fila.dashboard.embudo,
    anterior: e.fila.dashboard.anterior?.embudo,
    referencia: e.referencia,
    filtros: filtrosDelHub(c),
    periodo: periodoEnPalabras(c),
    enCurso: enCurso(c),
    avisarSinMarcarDelGrupo: true,
  };
  return {
    asistencia: cifraDeAsistencia(partes, e.explicaciones.asistencia),
    cierreDeVentas: cifraDeCierreDeVentas(partes, e.explicaciones.cierre_de_ventas),
  };
}
