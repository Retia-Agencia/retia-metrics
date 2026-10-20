import { and, eq, gte, sql } from "drizzle-orm";
import { eventosMeta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export type ResumenMetaCapi = {
  enviado: number;
  fallido: number;
  vencido: number;
  omitido: number;
  enviadosConFbc: number;
  enviadosTotal: number;
};

export async function resumenMetaCapi(db: Db, programId: string, ahora = new Date()): Promise<ResumenMetaCapi> {
  const desde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [fila] = await db.select({
    enviado: sql<number>`count(*) filter (where ${eventosMeta.estado} = 'enviado')::int`,
    fallido: sql<number>`count(*) filter (where ${eventosMeta.estado} = 'fallido')::int`,
    vencido: sql<number>`count(*) filter (where ${eventosMeta.estado} = 'vencido')::int`,
    omitido: sql<number>`count(*) filter (where ${eventosMeta.estado} = 'omitido')::int`,
    enviadosConFbc: sql<number>`count(*) filter (where ${eventosMeta.estado} = 'enviado' and ${eventosMeta.llevoFbc} = true)::int`,
    enviadosTotal: sql<number>`count(*) filter (where ${eventosMeta.estado} = 'enviado')::int`,
  }).from(eventosMeta).where(and(eq(eventosMeta.programId, programId), gte(eventosMeta.eventTime, desde)));
  return fila ?? { enviado: 0, fallido: 0, vencido: 0, omitido: 0, enviadosConFbc: 0, enviadosTotal: 0 };
}
