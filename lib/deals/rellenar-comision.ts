import { and, eq, inArray, isNull } from "drizzle-orm";
import { deals, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { vigente } from "@/lib/queries/vigente";
import { ETAPAS_VENDIDAS } from "./etapas";

export interface ResumenDeComisionPorPrograma {
  programa: string;
  porcentaje: string | null;
  ventasSinPorcentaje: number;
  rellenables: number;
}

/**
 * Completa ventas historicas con el porcentaje ACTUAL del programa. No existe un
 * historial del porcentaje que permita reconstruir el valor vigente al vender.
 * En seco solo informa; al aplicar, cada campo queda registrado en `change_log`.
 */
export async function rellenarComisionDeVentas(
  db: Db,
  { aplicar, actorId }: { aplicar: boolean; actorId: string | null },
): Promise<ResumenDeComisionPorPrograma[]> {
  return db.transaction(async (tx) => {
    const filas = await tx
      .select({
        dealId: deals.id,
        programId: programs.id,
        programa: programs.nombre,
        porcentaje: programs.comisionPorcentaje,
      })
      .from(deals)
      .innerJoin(programs, eq(programs.id, deals.programId))
      .where(
        and(
          vigente(deals),
          inArray(deals.etapa, ETAPAS_VENDIDAS),
          isNull(deals.comisionPorcentaje),
        ),
      );

    const resumen = new Map<string, ResumenDeComisionPorPrograma>();
    for (const fila of filas) {
      const clave = fila.programId;
      const actual = resumen.get(clave) ?? {
        programa: fila.programa,
        porcentaje: fila.porcentaje,
        ventasSinPorcentaje: 0,
        rellenables: 0,
      };
      actual.ventasSinPorcentaje += 1;
      if (fila.porcentaje !== null) actual.rellenables += 1;
      resumen.set(clave, actual);

      if (aplicar && fila.porcentaje !== null) {
        await editarConRastro(
          {
            db: tx,
            tabla: deals,
            nombreTabla: "deals",
            actorId,
            etiqueta: fila.dealId,
          },
          fila.dealId,
          { comisionPorcentaje: fila.porcentaje },
        );
      }
    }

    return [...resumen.values()];
  });
}
