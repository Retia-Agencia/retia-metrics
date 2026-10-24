import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { MEDIOS_PAGOS } from "@/lib/atribucion/canal";
import { submissions } from "@/lib/db/schema";

type ColumnaTexto = PgColumn | SQL;

export interface ColumnasCanalSql {
  source: ColumnaTexto;
  medium: ColumnaTexto;
}

/** Columnas de ids cuyo significado solo interpreta este módulo de atribución. */
export const columnasIdMetaDelEnvio = {
  utmId: submissions.utmId,
  respuestas: submissions.respuestas,
};

/** Categoría operativa del UTM; encapsula también las columnas de significado contextual. */
export function categoriaUtmSql() {
  const columnas = [
    submissions.utmSource,
    submissions.utmMedium,
    submissions.utmCampaign,
    submissions.utmContent,
    submissions.utmTerm,
    submissions.utmId,
  ];
  const macro = sql.join(columnas.map((columna) => sql`${columna} like '%{{%'`), sql` or `);
  return sql<string>`case
    when ${macro} then 'macro'
    when ${submissions.utmSource} is null and ${submissions.utmMedium} is null
      and ${submissions.utmCampaign} is null then 'sin_utm'
    else 'con_utm' end`;
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
export function areaSql(columnas: ColumnasCanalSql, idEnArbol?: SQL<boolean>) {
  const source = normalizarSql(columnas.source);
  const medium = normalizarSql(columnas.medium);
  const mediosPagos = sql.raw(MEDIOS_PAGOS.map((medio) => `'${medio}'`).join(", "));
  return sql<string>`case
    ${idEnArbol ? sql`when ${idEnArbol} then 'paid'` : sql``}
    when ${medium} in (${mediosPagos}) then 'paid'
    when ${medium} = 'referido' then 'referidos'
    when ${source} is not null or ${medium} is not null then 'organico'
    else 'sin_utm'
  end`;
}

/**
 * Un id presente en el árbol del mismo programa es el primer paso de la regla de área.
 * Gemela de `utmsDelEnvio` + `emparejar`: `utm_id` cae a `respuestas` como allá (envíos
 * anteriores a la 0048). Las llaves de `respuestas` van exactas en minúscula, que es como
 * las declaran los Typeform; la versión de TypeScript además tolera mayúsculas.
 */
export function idEnArbolSql(columnas: {
  programId: ColumnaTexto;
  utmId: ColumnaTexto;
  respuestas: ColumnaTexto;
}) {
  const id = (columna: ColumnaTexto) => sql<string | null>`case
    when ${columna} is null or btrim(${columna}) = '' or btrim(${columna}) like '%{{%' then null
    else btrim(${columna})
  end`;
  return sql<boolean>`exists (
    select 1 from pauta_objetos po
    where po.program_id = ${columnas.programId}
      and po.id_meta in (
        ${id(sql<string>`coalesce(${columnas.utmId}, ${columnas.respuestas}->>'utm_id')`)},
        ${id(sql<string>`${columnas.respuestas}->>'ad_id'`)},
        ${id(sql<string>`${columnas.respuestas}->>'adset_id'`)},
        ${id(sql<string>`${columnas.respuestas}->>'campaign_id'`)}
      )
  )`;
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
