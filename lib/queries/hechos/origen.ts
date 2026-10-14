import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { areaSql, canalSql, cuentaSql } from "@/lib/atribucion/canal-sql";

type Expresion = PgColumn | SQL;

export function dimensionesDeOrigen(
  submissionId: Expresion,
  source: Expresion,
  medium: Expresion,
) {
  const columnas = { source, medium };
  return {
    area: sql<string>`case when ${submissionId} is null then 'sin_envio_origen' else ${areaSql(columnas)} end`,
    canal: sql<string | null>`case when ${submissionId} is null then 'sin_envio_origen' else ${canalSql(columnas)} end`,
    cuenta: sql<string | null>`case when ${submissionId} is null then 'sin_envio_origen' else ${cuentaSql(columnas)} end`,
  };
}
