import type { Rango } from "@/lib/queries/dashboard";

/** Serie filtrable: cada fila conserva la frontera del programa y todas sus dimensiones. */
export type Serie<D, M> = Array<{ programId: string } & D & M>;

/** Toda consulta de una serie exige el programa; nunca existe un agregado accidental entre programas. */
export interface AlcanceDeSerie {
  programId: string;
  rango: Rango;
}

const MS_POR_DIA = 86_400_000;
const formatoIsoUtc = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });

function instanteUtc(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`);
}

function diaUtc(instante: number): string {
  return formatoIsoUtc.format(new Date(instante));
}

/** El periodo inmediatamente anterior, con la misma cantidad inclusiva de dias. */
export function periodoAnterior(rango: Rango): Rango {
  const desde = instanteUtc(rango.desde);
  const hasta = instanteUtc(rango.hasta);
  const cantidadDeDias = Math.round((hasta - desde) / MS_POR_DIA) + 1;
  const hastaAnterior = desde - MS_POR_DIA;
  return {
    desde: diaUtc(hastaAnterior - (cantidadDeDias - 1) * MS_POR_DIA),
    hasta: diaUtc(hastaAnterior),
  };
}
