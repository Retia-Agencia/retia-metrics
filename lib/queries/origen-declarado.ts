import { and, eq, inArray } from "drizzle-orm";
import { resolverCanal, type CanalActivo } from "@/lib/atribucion/canal";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { areas, canales, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vendidosEn, type Rango } from "@/lib/queries/dashboard";
import { vigente } from "@/lib/queries/vigente";

export interface VentasSinUtmPorArea {
  areaId: string | null;
  nombre: string | null;
  ventas: number;
}

/**
 * La burbuja "sin UTM · según el comercial" (ticket 121, ADR 0062 punto 5): las ventas del
 * rango que llegaron sin UTM, agrupadas por el área que declaró el closer. Una venta CON UTM
 * no entra aunque su área declarada sea otra: lo declarado nunca corrige al UTM.
 *
 * La venta y su fecha son las del dashboard (`vendidosEn`), así la burbuja no puede contar
 * una venta distinta de la que cuenta el embudo.
 */
export async function ventasSinUtmPorAreaDeclarada(
  db: Db,
  programId: string,
  rango: Rango,
): Promise<VentasSinUtmPorArea[]> {
  const [catalogo, filas] = await Promise.all([
    db.select().from(canales).where(eq(canales.activo, true)),
    db
      .select({
        areaId: deals.areaDeclaradaId,
        nombre: areas.nombre,
        submissionId: submissions.id,
        ...columnasUtmDelEnvio,
      })
      .from(deals)
      .leftJoin(areas, eq(areas.id, deals.areaDeclaradaId))
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(and(eq(deals.programId, programId), inArray(deals.id, vendidosEn(db, rango)), vigente(deals))),
  ]);

  const agrupadas = new Map<string, VentasSinUtmPorArea>();
  for (const fila of filas) {
    // Sin envío de origen (ADR 0060) también es "sin UTM": no hay clic que atribuir.
    const sinUtm =
      fila.submissionId === null || resolverCanal(utmsDelEnvio(fila), catalogo as CanalActivo[]).tipo === "sin_utm";
    if (!sinUtm) continue;
    const clave = fila.areaId ?? "";
    const actual = agrupadas.get(clave);
    if (actual) actual.ventas += 1;
    else agrupadas.set(clave, { areaId: fila.areaId, nombre: fila.nombre, ventas: 1 });
  }

  return [...agrupadas.values()].sort(
    (a, b) => b.ventas - a.ventas || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"),
  );
}
