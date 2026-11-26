import { and, eq, lte, sql, type SQL } from "drizzle-orm";
import { calls } from "@/lib/db/schema";

/** Confirmada antes de su hora, sobre los timestamps crudos de la cita. */
export function confirmadaAntesDeLaCitaSql(): SQL<boolean> {
  const confirmadaAntes = and(
    eq(calls.confirmacion, "confirmada"),
    lte(calls.confirmacionEn, sql`coalesce(${calls.fechaAgenda}, ${calls.fechaLlamada})`),
  )!;
  return sql<boolean>`coalesce(${confirmadaAntes}, false)`;
}

/** Gemela en memoria del predicado SQL de confirmación oportuna. */
export function confirmadaAntesDeLaCita({
  confirmacion,
  confirmacionEn,
  instante,
}: {
  confirmacion: (typeof calls.$inferSelect)["confirmacion"];
  confirmacionEn: Date | null;
  instante: Date;
}): boolean {
  return confirmacion === "confirmada"
    && confirmacionEn !== null
    && confirmacionEn.getTime() <= instante.getTime();
}
