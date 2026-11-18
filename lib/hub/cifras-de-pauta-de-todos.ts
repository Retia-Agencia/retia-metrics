/**
 * La franja de totales de la Pauta de `/hub` (ticket 422, DT-1), como Cifras.
 *
 * Solo entra lo que el ADR 0048 deja sumar entre programas y en una misma unidad: la inversión (COP), las agendas de
 * Paid, las ventas de Paid y lo vendido (USD). Ninguna tasa, costo ni ROAS: esos van por programa, en la tabla de cada
 * uno. Recibe la tabla semanal que la página YA leyó (`VistaPautaSemanal.filas[].celdas.total`) y no consulta ni recalcula.
 *
 * Un programa sin dato en el periodo (sin gasto cargado, por ejemplo) NO aporta cero: no suma, se nombra en la
 * explicación y la cifra queda «Parcial». Si ningún programa tiene dato, la cifra es «—» con su motivo.
 *
 * Módulo PURO.
 */
import { enCurso, periodoDelHub } from "@/lib/hub/contexto-de-cifras";
import { armarCifra, type CifraDeMetrica } from "@/lib/metricas/cifra";
import { explicacionSemanal } from "@/lib/pauta/cifra-de-celda-semanal";
import type { ClavePautaSemanal, VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";

/** Las filas de la tabla semanal que se pueden sumar entre programas, con su moneda (ADR 0048). */
export const FILAS_SUMABLES_DE_PAUTA = ["inversion", "agendas", "ventas", "facturacion"] as const satisfies readonly ClavePautaSemanal[];
export type FilaSumableDePauta = (typeof FILAS_SUMABLES_DE_PAUTA)[number];

const MOTIVO_SIN_DATO: Record<FilaSumableDePauta, string> = {
  inversion: "Ningún programa tiene gasto cargado en el periodo",
  agendas: "Ningún programa tiene agendas de Paid en el periodo",
  ventas: "Ningún programa tiene ventas de Paid en el periodo",
  facturacion: "Ningún programa tiene ventas con valor vendido en el periodo",
};

export interface ProgramaConPautaSemanal {
  programa: { nombre: string };
  semanal: Pick<VistaPautaSemanal, "filas">;
}

export function cifrasDeTotalesDePauta(e: {
  programas: readonly ProgramaConPautaSemanal[];
  rango: { desde: string; hasta: string };
  hoy: string;
}): CifraDeMetrica[] {
  const contexto = { programa: "Todos los programas", cohorte: null, rango: e.rango, hoy: e.hoy, closer: null };
  return FILAS_SUMABLES_DE_PAUTA.map((clave) => {
    const aportes = e.programas.map(({ programa, semanal }) => ({
      nombre: programa.nombre,
      valor: semanal.filas.find((fila) => fila.clave === clave)?.celdas.total.valor ?? null,
    }));
    const conDato = aportes.filter((a) => a.valor !== null);
    const sinDato = aportes.filter((a) => a.valor === null).map((a) => a.nombre);
    const total = conDato.reduce((suma, a) => suma + a.valor!, 0);
    const porPrograma = conDato.map((a) => `${a.nombre}: ${a.valor}`);
    return armarCifra({
      concepto: clave,
      explicacion: explicacionSemanal(clave),
      valor: conDato.length === 0 ? null : total,
      motivo: conDato.length === 0 ? MOTIVO_SIN_DATO[clave] : undefined,
      parcial: conDato.length > 0 && sinDato.length > 0
        ? `${sinDato.join(", ")} no ${sinDato.length === 1 ? "tiene" : "tienen"} dato en el periodo y no ${sinDato.length === 1 ? "suma" : "suman"}.`
        : undefined,
      filtros: [["Programas", e.programas.map((p) => p.programa.nombre).join(", ")], ["Área", "Paid"], ["Periodo", periodoDelHub(e.rango, e.hoy)]],
      periodo: `del ${periodoDelHub(e.rango, e.hoy)}`,
      enCurso: enCurso(contexto),
      notas: [["Suma de programas", `Es la suma de cada programa, en la misma unidad${porPrograma.length > 0 ? ` (${porPrograma.length} de ${aportes.length} con dato)` : ""}. Las tasas, los costos y el ROAS no se suman: van por programa, en su tabla.`]],
    });
  });
}
