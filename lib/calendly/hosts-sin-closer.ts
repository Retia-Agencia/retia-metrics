import { and, asc, count, eq, min, sql } from "drizzle-orm";
import { citaSinCloserConHost } from "@/lib/calendly/suelta";
import { calls, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

export interface HostDeCalendlySinCloser {
  programId: string;
  programaNombre: string;
  host: string;
  citas: number;
  proxima: Date | null;
}

export async function hostsDeCalendlySinCloser(db: Db): Promise<HostDeCalendlySinCloser[]> {
  const host = sql<string>`lower(${calls.calendlyHostEmail})`;
  return db
    .select({
      programId: programs.id,
      programaNombre: programs.nombre,
      host,
      citas: count(),
      proxima: min(calls.fechaAgenda),
    })
    .from(calls)
    .innerJoin(programs, eq(programs.id, calls.programId))
    .where(and(citaSinCloserConHost(), eq(programs.activo, true), vigente(calls)))
    .groupBy(programs.id, programs.nombre, host)
    .orderBy(asc(programs.nombre), asc(host));
}
