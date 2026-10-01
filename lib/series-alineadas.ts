import type { AlcanceDeSerie, Serie } from "@/lib/queries/serie";
import { sumarDias } from "@/lib/rangos";

interface DimensionDeDia {
  dia: string;
}

interface SerieAlineada {
  clave: string;
  valores: number[];
}

export interface SeriesAlineadas {
  programId: string;
  dias: string[];
  series: SerieAlineada[];
}

/**
 * Alinea los valores de una dimensión sobre los mismos días para superponerlos
 * sin desplazar puntos cuando falta actividad. Suma las filas del mismo grupo y
 * rellena los huecos con cero; las demás dimensiones no se vuelven líneas aparte.
 *
 * El programa se exige y se comprueba antes de agrupar: una serie ajena no puede
 * mezclarse silenciosamente con la del alcance, aunque sus días queden fuera.
 */
export function pivotarSerie<F extends Serie<DimensionDeDia, object>[number]>(
  filas: F[],
  alcance: AlcanceDeSerie,
  dimension: (fila: F) => string,
  metrica: (fila: F) => number,
): SeriesAlineadas {
  const dias: string[] = [];
  for (let dia = alcance.rango.desde; dia <= alcance.rango.hasta; dia = sumarDias(dia, 1)) {
    dias.push(dia);
  }

  const indices = new Map(dias.map((dia, i) => [dia, i]));
  const grupos = new Map<string, number[]>();
  for (const fila of filas) {
    if (fila.programId !== alcance.programId) {
      throw new Error("Una gráfica no puede cruzar programas.");
    }

    const indice = indices.get(fila.dia);
    if (indice === undefined) continue;

    const clave = dimension(fila);
    const valores = grupos.get(clave) ?? Array<number>(dias.length).fill(0);
    valores[indice] += metrica(fila);
    grupos.set(clave, valores);
  }

  return {
    programId: alcance.programId,
    dias,
    series: [...grupos]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, valores]) => ({
        clave,
        valores,
      })),
  };
}
