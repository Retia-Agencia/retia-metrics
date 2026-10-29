import type { ProgramaVisible } from "@/lib/auth/alcance";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import type { PeriodoResuelto } from "@/lib/periodo";
import { vistaDeEscalera, type VistaDeEscalera } from "@/lib/queries/vista-escalera";

/**
 * La escalera en "todos los programas" (ticket 320, ADR 0048): una distribución POR programa, lado a
 * lado. El tipo de la salida es una lista de filas por programa y nada más: no hay un total, un
 * porcentaje combinado ni un campo de agregado, y los porcentajes son `Tasa`, que ninguna función de
 * suma de `agregado-programas.ts` acepta. Una tasa combinada de dos programas se vería creíble sin
 * serlo (tickets y ciclos distintos).
 */
export interface EscaleraDeUnPrograma {
  readonly programa: ProgramaVisible;
  readonly vista: VistaDeEscalera;
}

export async function escaleraPorPrograma(
  entrada: {
    programas: readonly ProgramaVisible[];
    hoy: string;
    periodo: PeriodoResuelto;
    origen: string;
    /** Quien puede abrir las listas de un programa (administra); sin él las cifras salen sin enlace. */
    conListas: boolean;
    ahora?: Date;
  },
  db: Db = dbDeLaApp,
): Promise<readonly EscaleraDeUnPrograma[]> {
  return Promise.all(entrada.programas.map(async (programa) => ({
    programa,
    vista: await vistaDeEscalera({
      programId: programa.id,
      slug: programa.slug,
      hoy: entrada.hoy,
      periodo: entrada.periodo,
      claveCloser: null,
      origen: entrada.origen,
      conEquipo: entrada.conListas,
      soloPrincipal: true,
      ahora: entrada.ahora,
    }, db),
  })));
}
