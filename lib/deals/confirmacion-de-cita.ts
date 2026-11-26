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
