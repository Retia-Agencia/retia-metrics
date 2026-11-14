/**
 * Hub › Comercial como Cifras (ticket 419, enmienda del 13-nov, fase E-2).
 *
 * Recibe lo que la página YA consultó (`VistaDelDashboard`, los detalles de cada lista, el dinero por closer) y lo
 * vuelve `CifraDeMetrica`. No consulta la base ni recalcula: el valor de cada cifra es el campo de la vista que hoy
 * pinta la pantalla, y las partes de cada tasa son las del grupo de citas que trae la consulta (N1).
 *
 * El TEXTO de cada concepto llega por `explicaciones` y no vive aquí: es de la ficha del concepto (E-1), y quien llama
 * le pone el universo de la pestaña (DC-2). La proyección por rol tampoco se decide aquí: a quien no abre listas le
 * llegan los detalles sin enlace (`sinListas`) y la cifra sale sin evidencia.
 *
 * Módulo PURO (solo importa tipos de `lib/queries/`): su salida viaja como props a un componente cliente.
 */
import { fechaCorta, num } from "@/lib/format";
import { armarCifra, type CifraDeMetrica, type EntradaDeCifra, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import { entradaDesdeRazon } from "@/lib/metricas/razon-a-cifra";
import type { EmbudoDelRango } from "@/lib/queries/dashboard";
import type { DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

/** Los conceptos de Comercial que este módulo pinta. El texto de cada uno lo entrega quien llama. */
export const CONCEPTOS_DE_COMERCIAL = [
  "citas", "asistencia", "cierre_de_ventas", "cita_a_venta", "citas_sin_marcar", "vendido", "recaudado", "por_cobrar",
] as const;
export type ConceptoDeComercial = (typeof CONCEPTOS_DE_COMERCIAL)[number];
export type ExplicacionesDeComercial = Record<ConceptoDeComercial, ExplicacionDeConcepto>;

/** Las listas que abre Comercial: las cinco primeras filas de cada una, ya escritas, las lee la página. */
export type ListaDeComercial = "agendas" | "grupo_citas" | "grupo_shows" | "grupo_pendientes" | "cierres";
export type FilasDeEvidencia = ReadonlyArray<ReadonlyArray<string>>;

export interface ContextoDeComercial {
  programa: string;
  /** El código de la cohorte elegida, o `null` con "Todas". */
  cohorte: string | null;
  rango: { desde: string; hasta: string };
  hoy: string;
  /** El nombre del closer del filtro, o `null` con todos. */
  closer: string | null;
}

type Lista = NonNullable<EntradaDeCifra["lista"]>;
type Comparacion = NonNullable<EntradaDeCifra["comparacion"]>;

const BASE_DE_LAS_TASAS = "personas ya tienen resultado marcado";
const MOTIVO_SIN_CITAS = "Sin citas en el periodo";
export const MOTIVO_SIN_VENTAS_DEL_CLOSER = "Este closer no tiene ventas en el periodo";

/** El periodo como se lee en "Calculada con": "1-nov a hoy", o un solo día. */
export function periodoDeComercial(rango: { desde: string; hasta: string }, hoy: string): string {
  const dia = (d: string) => (d === hoy ? "hoy" : fechaCorta(d));
  return rango.desde === rango.hasta ? dia(rango.desde) : `${fechaCorta(rango.desde)} a ${dia(rango.hasta)}`;
}

function filtrosDe(c: ContextoDeComercial, closer: string | null = c.closer): Array<readonly [string, string]> {
  const filtros: Array<readonly [string, string]> = [
    ["Programa", c.programa],
    ["Cohorte", c.cohorte ?? "Todas"],
    ["Periodo", periodoDeComercial(c.rango, c.hoy)],
  ];
  if (closer) filtros.push(["Closer", closer]);
  return filtros;
}

function periodoEnPalabras(c: ContextoDeComercial): string {
  const dia = (d: string) => (d === c.hoy ? "hoy" : `el ${fechaCorta(d)}`);
  return c.rango.desde === c.rango.hasta ? dia(c.rango.desde) : `del ${fechaCorta(c.rango.desde)} a ${dia(c.rango.hasta)}`;
}

/** La lista de una cifra, solo si la sesión la puede abrir (con `sinListas` el detalle llega sin enlace). */
function listaDe(
  detalle: DetalleDeCifra | null | undefined,
  filas: FilasDeEvidencia | undefined,
  forma: Pick<Lista, "nombre" | "articulo" | "parte">,
): Lista | undefined {
  if (!detalle || !detalle.href || !detalle.resumen.disponible) return undefined;
  return { href: detalle.href, total: detalle.resumen.subtotal.cantidad, filas: filas ?? [], ...forma };
}

function comparar(referencia: string | undefined, valor: number | null | undefined): Comparacion | undefined {
  return referencia === undefined || valor === undefined ? undefined : { referencia, valor };
}

// ---------------------------------------------------------------------------------------------------------------
// Cifras clave

export interface EntradaDeCifrasClave {
  embudo: EmbudoDelRango;
  /** El embudo del periodo de comparación, solo si se pidió comparar. */
  anterior?: EmbudoDelRango | null;
  /** Contra qué se compara, en palabras: "el periodo anterior", "C5 al mismo día". Nunca "periodo B". */
  referencia?: string;
  detalles?: Partial<Record<ListaDeComercial, DetalleDeCifra>>;
  evidencia?: Partial<Record<ListaDeComercial, FilasDeEvidencia>>;
  explicaciones: ExplicacionesDeComercial;
  contexto: ContextoDeComercial;
}

export interface CifrasClaveDeComercial {
  citas: CifraDeMetrica;
  asistencia: CifraDeMetrica;
  cierreDeVentas: CifraDeMetrica;
  citaAVenta: CifraDeMetrica;
  /** Solo si hay citas pasadas sin resultado: es el aviso que hoy acompaña a las tasas. */
  sinMarcar: CifraDeMetrica | null;
}

interface PartesDelGrupo {
  embudo: EmbudoDelRango;
  anterior?: EmbudoDelRango | null;
  referencia?: string;
  detalles?: Partial<Record<ListaDeComercial, DetalleDeCifra>>;
  evidencia?: Partial<Record<ListaDeComercial, FilasDeEvidencia>>;
  explicaciones: ExplicacionesDeComercial;
  filtros: Array<readonly [string, string]>;
  periodo: string;
  enCurso: boolean;
}

/** Las tres tasas del grupo de citas: las mismas para el programa y para la fila de un closer. */
function tasasDelGrupo(p: PartesDelGrupo): Pick<CifrasClaveDeComercial, "asistencia" | "cierreDeVentas" | "citaAVenta"> {
  const g = p.embudo.grupo;
  const comun = { filtros: p.filtros, periodo: p.periodo, enCurso: p.enCurso };
  const ref = p.anterior ? p.referencia : undefined;
  const citaAVenta = entradaDesdeRazon(g.razonAgendaAVenta, { base: BASE_DE_LAS_TASAS });
  return {
    asistencia: armarCifra({
      concepto: "asistencia",
      explicacion: p.explicaciones.asistencia,
      ...entradaDesdeRazon(p.embudo.razonShow, { base: BASE_DE_LAS_TASAS }),
      partes: [g.conShow, g.deals],
      comparacion: comparar(ref, p.anterior?.razonShow.valor),
      lista: listaDe(p.detalles?.grupo_citas, p.evidencia?.grupo_citas, { nombre: "personas con resultado marcado", articulo: "las", parte: "abajo" }),
      ...comun,
    }),
    cierreDeVentas: armarCifra({
      concepto: "cierre_de_ventas",
      explicacion: p.explicaciones.cierre_de_ventas,
      ...entradaDesdeRazon(p.embudo.razonCierre, { base: BASE_DE_LAS_TASAS }),
      partes: [g.vendidos, g.conShow],
      comparacion: comparar(ref, p.anterior?.razonCierre.valor),
      lista: listaDe(p.detalles?.grupo_shows, p.evidencia?.grupo_shows, { nombre: "personas con cita realizada", articulo: "las", parte: "abajo" }),
      ...comun,
    }),
    citaAVenta: armarCifra({
      concepto: "cita_a_venta",
      explicacion: p.explicaciones.cita_a_venta,
      // El valor es el campo que hoy pinta la pantalla; de la razón del grupo solo sale si es parcial.
      valor: p.embudo.agendaAVenta,
      motivo: p.embudo.agendaAVenta === null ? g.razonAgendaAVenta.motivo ?? MOTIVO_SIN_CITAS : undefined,
      parcial: p.embudo.agendaAVenta === null ? undefined : citaAVenta.parcial,
      partes: [g.vendidos, g.deals],
      comparacion: comparar(ref, p.anterior?.agendaAVenta),
      lista: listaDe(p.detalles?.grupo_citas, p.evidencia?.grupo_citas, { nombre: "personas del grupo de citas", articulo: "las", parte: "abajo" }),
      ...comun,
    }),
  };
}

function cifraSinMarcar(p: PartesDelGrupo): CifraDeMetrica | null {
  const sinMarcar = p.embudo.grupo.sinMarcar;
  if (sinMarcar <= 0) return null;
  return armarCifra({
    concepto: "citas_sin_marcar",
    explicacion: p.explicaciones.citas_sin_marcar,
    valor: sinMarcar,
    filtros: p.filtros,
    periodo: p.periodo,
    lista: listaDe(p.detalles?.grupo_pendientes, p.evidencia?.grupo_pendientes, { nombre: "citas sin marcar", articulo: "las" }),
  });
}

export function cifrasClaveDeComercial(e: EntradaDeCifrasClave): CifrasClaveDeComercial {
  const c = e.contexto;
  const partes: PartesDelGrupo = {
    embudo: e.embudo,
    anterior: e.anterior,
    referencia: e.referencia,
    detalles: e.detalles,
    evidencia: e.evidencia,
    explicaciones: e.explicaciones,
    filtros: filtrosDe(c),
    periodo: periodoEnPalabras(c),
    enCurso: c.rango.hasta >= c.hoy,
  };
  return {
    citas: armarCifra({
      concepto: "citas",
      explicacion: e.explicaciones.citas,
      valor: e.embudo.agendas,
      comparacion: comparar(e.anterior ? e.referencia : undefined, e.anterior?.agendas),
      lista: listaDe(e.detalles?.agendas, e.evidencia?.agendas, { nombre: "citas", articulo: "las" }),
      filtros: partes.filtros,
      periodo: partes.periodo,
      enCurso: partes.enCurso,
    }),
    ...tasasDelGrupo(partes),
    sinMarcar: cifraSinMarcar(partes),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// La tabla de closers: cada celda, una Cifra.

/** Lo que la tabla necesita de una fila del comparativo (`VistaDelDashboard["comparativo"][number]`). */
export type FilaDelComparativo = EmbudoDelRango & { clave: string; closerId: string | null };

export interface EntradaDeCifrasDeCloser {
  fila: FilaDelComparativo;
  /** Vendido, Recaudado y Por cobrar de las ventas del closer en el periodo; ausente si no se consultó. */
  dinero?: DineroDeVentas;
  detalles?: Partial<Record<ListaDeComercial, DetalleDeCifra>>;
  evidencia?: Partial<Record<ListaDeComercial, FilasDeEvidencia>>;
  explicaciones: ExplicacionesDeComercial;
  contexto: ContextoDeComercial;
}

export interface CifrasDeCloser {
  clave: string;
  closer: string;
  citas: CifraDeMetrica;
  asistencia: CifraDeMetrica;
  cierreDeVentas: CifraDeMetrica;
  citaAVenta: CifraDeMetrica;
  sinMarcar: CifraDeMetrica | null;
  vendido: CifraDeMetrica;
  recaudado: CifraDeMetrica;
  porCobrar: CifraDeMetrica;
}

export function cifrasDeCloser(e: EntradaDeCifrasDeCloser): CifrasDeCloser {
  const c = e.contexto;
  const closer = e.fila.closerId ?? "Sin closer";
  const filtros = filtrosDe(c, closer);
  const periodo = periodoEnPalabras(c);
  const enCurso = c.rango.hasta >= c.hoy;
  const partes: PartesDelGrupo = {
    embudo: e.fila, detalles: e.detalles, evidencia: e.evidencia, explicaciones: e.explicaciones, filtros, periodo, enCurso,
  };
  const d = e.dinero;
  const conVentas = d !== undefined && d.ventas > 0;
  const sinSaldo = d && d.sinSaldoCalculable > 0
    ? `${num(d.sinSaldoCalculable)} ${d.sinSaldoCalculable === 1 ? "venta quedó" : "ventas quedaron"} fuera porque su saldo no se puede calcular.`
    : undefined;
  const dinero = (concepto: "vendido" | "recaudado" | "por_cobrar", valor: number | undefined) => armarCifra({
    concepto,
    explicacion: e.explicaciones[concepto],
    valor: conVentas && valor !== undefined ? valor : null,
    motivo: conVentas ? undefined : MOTIVO_SIN_VENTAS_DEL_CLOSER,
    parcial: conVentas ? sinSaldo : undefined,
    lista: listaDe(e.detalles?.cierres, e.evidencia?.cierres, { nombre: "ventas", articulo: "las" }),
    filtros,
    periodo,
    enCurso,
  });
  return {
    clave: e.fila.clave,
    closer,
    citas: armarCifra({
      concepto: "citas",
      explicacion: e.explicaciones.citas,
      valor: e.fila.agendas,
      lista: listaDe(e.detalles?.agendas, e.evidencia?.agendas, { nombre: "citas", articulo: "las" }),
      filtros,
      periodo,
      enCurso,
    }),
    ...tasasDelGrupo(partes),
    sinMarcar: cifraSinMarcar(partes),
    vendido: dinero("vendido", d?.vendido),
    recaudado: dinero("recaudado", d?.recaudado),
    porCobrar: dinero("por_cobrar", d?.porCobrar),
  };
}
