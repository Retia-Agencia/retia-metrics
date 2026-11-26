/**
 * Mi espacio › Métricas como Cifras (ticket 419, fase E-5).
 *
 * Recibe lo que la página YA consultó (`VistaDeMisMetricas`) y lo vuelve `CifraDeMetrica`.
 * No consulta ni recalcula. Todas llevan el universo «tuyas» (DC-4): solo los deals y las llamadas del closer que mira.
 * El closer no entra al Hub (ADR 0082): esto no le abre nada nuevo, solo cambia la forma de lo que ya veía.
 *
 * Módulo PURO (solo importa tipos de `lib/queries/`).
 */
import { cifrasDeEntroACaja } from "@/lib/hub/cifras-de-dinero";
import {
  comparacionCon, enCurso, filtrosDelHub, listaDeDetalle, periodoEnPalabras, type ContextoDelHub,
} from "@/lib/hub/contexto-de-cifras";
import { entradaDesdeRazon } from "@/lib/metricas/razon-a-cifra";
import { armarCifra, type CifraDeMetrica, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { VistaDeMisMetricas } from "@/lib/queries/mi-espacio-metricas";

export const CONCEPTOS_DE_MI_ESPACIO = [
  "citas", "shows", "asistencia", "no_asistio", "show_sin_confirmar", "ventas", "cierre_de_ventas", "citas_pendientes", "comision", "entro_a_caja",
] as const;
export type ConceptoDeMiEspacio = (typeof CONCEPTOS_DE_MI_ESPACIO)[number];
export type ExplicacionesDeMiEspacio = Record<ConceptoDeMiEspacio, ExplicacionDeConcepto>;

/** «Tú»: el filtro de closer de Mi espacio es siempre la persona que mira. */
const TU = "Tú";
const BASE_DEL_CIERRE = "personas con cita realizada ya tienen resultado marcado";
const BASE_DE_LA_ASISTENCIA = "personas con cita pasada ya tienen resultado marcado";

export function contextoDeMiEspacio(e: { programa: string; periodo: VistaDeMisMetricas["periodo"]; hoy: string }): ContextoDelHub {
  return { programa: e.programa, cohorte: null, rango: e.periodo.a, hoy: e.hoy, closer: TU };
}

export interface CifrasDeMiPrograma {
  citas: CifraDeMetrica;
  realizadas: CifraDeMetrica;
  asistencia: CifraDeMetrica;
  noAsistio: CifraDeMetrica;
  showSinConfirmar: CifraDeMetrica;
  ventas: CifraDeMetrica;
  cierre: CifraDeMetrica;
  /** Solo si hay citas pasadas sin resultado. */
  sinResultado: CifraDeMetrica | null;
  /** Una por moneda; nunca una suma. */
  entroACaja: CifraDeMetrica[];
  comision: CifraDeMetrica;
}

export function cifrasDeMiPrograma(e: {
  vista: VistaDeMisMetricas; referencia?: string; explicaciones: ExplicacionesDeMiEspacio; hoy: string;
}): CifrasDeMiPrograma {
  const { vista: v, explicaciones: x } = e;
  const c = contextoDeMiEspacio({ programa: v.programa.nombre, periodo: v.periodo, hoy: e.hoy });
  const filtros = filtrosDelHub(c);
  const periodo = periodoEnPalabras(c);
  const comun = { filtros, periodo, enCurso: enCurso(c) };
  const ref = v.b ? e.referencia : undefined;
  const conteo = (concepto: ConceptoDeMiEspacio, valor: number, anterior: number | undefined, detalle: VistaDeMisMetricas["detalles"][keyof VistaDeMisMetricas["detalles"]], nombre: string) =>
    armarCifra({
      concepto, explicacion: x[concepto], valor, comparacion: comparacionCon(ref, anterior),
      lista: listaDeDetalle(detalle, undefined, { nombre, articulo: "las" }), ...comun,
    });
  const razonAsistencia = entradaDesdeRazon(v.a.razonShow, { base: BASE_DE_LA_ASISTENCIA });
  const razonShowSinConfirmar = entradaDesdeRazon(v.a.razonShowSinConfirmar, { base: BASE_DE_LA_ASISTENCIA });
  const razonCierre = entradaDesdeRazon(v.a.razonCierre, { base: BASE_DEL_CIERRE });
  const parcialMadurando = "Aún madurando: el rango terminó hace menos de 30 días.";
  const pendientes = v.a.pendientesDeResultado;
  return {
    citas: conteo("citas", v.a.agendas, v.b?.agendas, v.detalles.agendas, "citas"),
    realizadas: conteo("shows", v.a.shows, v.b?.shows, v.detalles.shows, "citas realizadas"),
    asistencia: armarCifra({
      concepto: "asistencia", explicacion: x.asistencia, ...razonAsistencia,
      comparacion: comparacionCon(ref, v.b?.razonShow.valor),
      lista: listaDeDetalle(v.detalles.grupoPendientes, undefined, { nombre: "citas sin marcar", articulo: "las" }),
      ...comun,
      parcial: razonAsistencia.parcial ?? (v.a.madurando ? parcialMadurando : undefined),
    }),
    noAsistio: conteo("no_asistio", v.a.noShows, v.b?.noShows, v.detalles.noShows, "citas sin asistencia"),
    showSinConfirmar: armarCifra({
      concepto: "show_sin_confirmar", explicacion: x.show_sin_confirmar, ...razonShowSinConfirmar,
      comparacion: comparacionCon(ref, v.b?.razonShowSinConfirmar.valor),
      lista: listaDeDetalle(v.detalles.grupoPendientes, undefined, { nombre: "citas sin marcar", articulo: "las" }),
      ...comun,
      parcial: razonShowSinConfirmar.parcial ?? (v.a.madurando ? parcialMadurando : undefined),
    }),
    ventas: conteo("ventas", v.a.cierres, v.b?.cierres, v.detalles.cierres, "ventas"),
    cierre: armarCifra({
      concepto: "cierre_de_ventas", explicacion: x.cierre_de_ventas, ...razonCierre,
      comparacion: comparacionCon(ref, v.b?.razonCierre.valor),
      lista: listaDeDetalle(v.detalles.grupoVendidos, undefined, { nombre: "personas con cita realizada", articulo: "las", parte: "abajo" }),
      ...comun,
      parcial: razonCierre.parcial ?? (v.a.madurando ? parcialMadurando : undefined),
    }),
    sinResultado: pendientes > 0
      ? armarCifra({
        concepto: "citas_pendientes", explicacion: x.citas_pendientes, valor: pendientes,
        lista: listaDeDetalle(v.detalles.grupoPendientes, undefined, { nombre: "citas sin marcar", articulo: "las" }), ...comun,
      })
      : null,
    entroACaja: cifrasDeEntroACaja({
      caja: v.a.caja, anterior: v.b?.caja, referencia: ref, detalle: v.detalles.caja, explicacion: x.entro_a_caja, contexto: c,
    }),
    comision: armarCifra({
      concepto: "comision", explicacion: x.comision, valor: v.a.comisionUsd,
      comparacion: comparacionCon(ref, v.b?.comisionUsd),
      lista: listaDeDetalle(v.detalles.cierres, undefined, { nombre: "ventas que generan comisión", articulo: "las" }), ...comun,
    }),
  };
}
