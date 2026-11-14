/** Hoy: las cinco banderas y el comparativo del día. Recibe datos calculados, sin base ni reloj (419 E-2). */
import { fechaCorta, num, pct } from "@/lib/format";
import { cifraDeAsistencia, cifraDeCierreDeVentas, type PartesDelGrupo } from "@/lib/hub/cifras-de-comercial";
import { cifrasDeEntroACaja } from "@/lib/hub/cifras-de-dinero";
import { listaDeDetalle, type FilasDeEvidencia } from "@/lib/hub/contexto-de-cifras";
import { armarCifra, type EntradaDeCifra, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetalleDeCifra, DetallesDelComparativo } from "@/lib/queries/vista-metrica";

interface DiaDeHoy { programa: string; dia: string; hoy: string }
const contextoDelDia = (e: DiaDeHoy) => ({ programa: e.programa, cohorte: null, closer: null, rango: { desde: e.dia, hasta: e.dia }, hoy: e.hoy });
function comunDelDia(e: DiaDeHoy) {
  return { filtros: [["Programa", e.programa], ["Día", e.dia === e.hoy ? "Hoy" : fechaCorta(e.dia)]] as Array<readonly [string, string]>,
    periodo: e.dia === e.hoy ? "hoy" : `el ${fechaCorta(e.dia)}`, enCurso: e.dia === e.hoy };
}
export const CONCEPTOS_DE_PENDIENTES = ["shows_sin_grain", "llamadas_sin_resultado", "atendidos_sin_valor", "atendidos_sin_grain", "perdidos_con_pagos"] as const;
export type BanderaDeHoy = (typeof CONCEPTOS_DE_PENDIENTES)[number];
export type ExplicacionesDePendientes = Record<BanderaDeHoy, ExplicacionDeConcepto>;

export function cifrasDePendientes(e: DiaDeHoy & {
  datos: Pick<VistaDelDashboard, "sinGrain" | "sinResultado" | "banderas">;
  explicaciones: ExplicacionesDePendientes;
  detalles?: Partial<Record<BanderaDeHoy | "sin_resultado", DetalleDeCifra>>;
  evidencia?: Partial<Record<BanderaDeHoy, FilasDeEvidencia>>;
}) {
  const d = e.datos;
  const comun = comunDelDia(e);
  const proporcion = (valor: number | null, base: number, nombre: string) => ({ antes: `${valor === null ? "—" : pct(valor)} de `, cifra: num(base), despues: ` ${nombre}` });
  const cifra = (concepto: BanderaDeHoy, valor: number, foto: boolean, linea?: EntradaDeCifra["linea"]) => armarCifra({
    concepto, explicacion: e.explicaciones[concepto], valor, ...comun,
    // Las tres banderas del deal son una foto actual aunque se lea el reporte de otro día.
    ...(foto ? { filtros: [["Programa", e.programa], ["Día", "Hoy"]] as const, periodo: "hoy", enCurso: false } : {}),
    linea,
    lista: listaDeDetalle(e.detalles?.[concepto === "llamadas_sin_resultado" ? "sin_resultado" : concepto], e.evidencia?.[concepto], { nombre: "casos", articulo: "los" }),
  });
  const banderas = [
    cifra("shows_sin_grain", d.sinGrain.sinGrain, false, proporcion(d.sinGrain.pct, d.sinGrain.shows, "realizadas")),
    cifra("llamadas_sin_resultado", d.sinResultado, false),
    cifra("atendidos_sin_valor", d.banderas.sinValor.cantidad, true, proporcion(d.banderas.sinValor.pct, d.banderas.atendidos, "atendidos")),
    cifra("atendidos_sin_grain", d.banderas.sinGrain.cantidad, true, proporcion(d.banderas.sinGrain.pct, d.banderas.atendidos, "atendidos")),
    cifra("perdidos_con_pagos", d.banderas.perdidosConPagos.cantidad, true, { antes: "Plata cobrada sobre una venta perdida" }),
  ];
  return { banderas, conCasos: banderas.filter((c) => c.valor! > 0), enCero: banderas.filter((c) => c.valor === 0) };
}

export const CONCEPTOS_DE_CLOSERS_DE_HOY = ["citas", "asistencia", "ventas", "cierre_de_ventas", "entro_a_caja"] as const;
export type ExplicacionesDeClosersDeHoy = Record<(typeof CONCEPTOS_DE_CLOSERS_DE_HOY)[number], ExplicacionDeConcepto>;

/** El comparativo de Hoy conserva Ventas y Entró a caja por quien registró el abono (no el dinero de sus ventas). */
export function cifrasDeClosersDeHoy(e: DiaDeHoy & {
  filas: VistaDelDashboard["comparativo"];
  explicaciones: ExplicacionesDeClosersDeHoy;
  detalles?: DetallesDelComparativo;
}) {
  const contexto = contextoDelDia(e);
  const comun = comunDelDia(e);
  return e.filas.map((fila) => {
    const closer = fila.closerId ?? "Sin closer";
    const filtros = [...comun.filtros, ["Closer", closer] as const];
    const detalles = e.detalles?.[fila.clave];
    const partes: PartesDelGrupo = { embudo: fila, detalles, ...comun, filtros };
    const conteo = (concepto: "citas" | "ventas", valor: number, detalle?: DetalleDeCifra) => armarCifra({
      concepto, explicacion: e.explicaciones[concepto], valor, ...comun, filtros,
      lista: listaDeDetalle(detalle, undefined, { nombre: concepto === "citas" ? "citas" : "ventas", articulo: "las" }),
    });
    const caja = cifrasDeEntroACaja({ caja: fila.caja, detalle: detalles?.caja, explicacion: e.explicaciones.entro_a_caja, contexto });
    // La caja comparte formato y separación por moneda con Dinero; aquí su alcance es Día y Closer.
    for (const c of caja) c.explicacion.filtros = [...filtros, ["Moneda", c.unidad === "cop" ? "COP" : "USD"]];
    return { clave: fila.clave, closer,
      citas: conteo("citas", fila.agendas, detalles?.agendas), asistencia: cifraDeAsistencia(partes, e.explicaciones.asistencia),
      ventas: conteo("ventas", fila.cierres, detalles?.cierres), cierreDeVentas: cifraDeCierreDeVentas(partes, e.explicaciones.cierre_de_ventas),
      entroACaja: caja,
    };
  });
}
