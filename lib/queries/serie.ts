import type { Rango } from "@/lib/queries/dashboard";

/** Serie filtrable: cada fila conserva la frontera del programa y todas sus dimensiones. */
export type Serie<D, M> = Array<{ programId: string } & D & M>;

/** Toda consulta de una serie exige el programa; nunca existe un agregado accidental entre programas. */
export interface AlcanceDeSerie {
  programId: string;
  rango: Rango;
  /** El filtro de cohorte del Hub (377); ausente = todas. */
  cohorteId?: string | null;
}
