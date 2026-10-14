import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { MEDIOS_PAGOS } from "@/lib/atribucion/canal";

type ColumnaTexto = PgColumn | SQL;

export interface ColumnasCanalSql {
  source: ColumnaTexto;
  medium: ColumnaTexto;
}

/** Gemela SQL de `normalizarUtm`: blancos y macros sin expandir son ausencia. */
function normalizarSql(columna: ColumnaTexto) {
  return sql<string | null>`case
    when ${columna} is null or btrim(${columna}) = '' or btrim(${columna}) like '%{{%'
      then null
    else lower(btrim(${columna}))
  end`;
}

function sourceSql(columna: ColumnaTexto) {
  return sql<string | null>`regexp_replace(${normalizarSql(columna)}, '[[:space:]]+', ' ', 'g')`;
}

function plataformaSql(source: SQL<string | null>) {
  const primera = sql<string>`split_part(${source}, ' ', 1)`;
  return sql<string | null>`case ${primera}
    when 'ig' then 'instagram'
    when 'fb' then 'facebook'
    when 'an' then 'audience network'
    when 'msg' then 'messenger'
    when 'th' then 'threads'
    else ${primera}
  end`;
}

/** Área calculada solo con source/medium, con las mismas prioridades que `resolverCanal`. */
export function areaSql(columnas: ColumnasCanalSql) {
  const source = normalizarSql(columnas.source);
  const medium = normalizarSql(columnas.medium);
  const mediosPagos = sql.raw(MEDIOS_PAGOS.map((medio) => `'${medio}'`).join(", "));
  return sql<string>`case
    when ${medium} in (${mediosPagos}) then 'paid'
    when ${medium} = 'referido' then 'referidos'
    when ${source} is not null or ${medium} is not null then 'organico'
    else 'sin_utm'
  end`;
}

/** Clave del canal: primera palabra (con alias) más la cuenta restante. */
export function canalSql(columnas: ColumnasCanalSql) {
  const source = sourceSql(columnas.source);
  const plataforma = plataformaSql(source);
  const cuenta = cuentaSql(columnas);
  return sql<string | null>`case
    when ${source} is null then null
    when ${cuenta} is null then ${plataforma}
    else ${plataforma} || ' ' || ${cuenta}
  end`;
}

/** Todo lo que sigue a la primera palabra del source, ya normalizado. */
export function cuentaSql(columnas: ColumnasCanalSql) {
  const source = sourceSql(columnas.source);
  return sql<string | null>`case
    when ${source} is null or strpos(${source}, ' ') = 0 then null
    else substring(${source} from strpos(${source}, ' ') + 1)
  end`;
}
