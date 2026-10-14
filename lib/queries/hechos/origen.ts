import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { areaSql, canalSql, columnasIdMetaDelEnvio, cuentaSql, idEnArbolSql } from "@/lib/atribucion/canal-sql";

type Expresion = PgColumn | SQL;

export function dimensionesDeOrigen(
  submissionId: Expresion,
  source: Expresion,
  medium: Expresion,
  programId: Expresion,
) {
  const columnas = { source, medium };
  const idEnArbol = idEnArbolSql({ programId, ...columnasIdMetaDelEnvio });
  return {
    area: sql<string>`case when ${submissionId} is null then 'sin_envio_origen' else ${areaSql(columnas, idEnArbol)} end`,
    canal: sql<string | null>`case when ${submissionId} is null then 'sin_envio_origen' else ${canalSql(columnas)} end`,
    cuenta: sql<string | null>`case when ${submissionId} is null then 'sin_envio_origen' else ${cuentaSql(columnas)} end`,
  };
}
