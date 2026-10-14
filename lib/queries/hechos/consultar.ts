import { and, asc, desc, inArray, isNull, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import type { Dimension, Filtros, Orden, Pagina } from "@/lib/queries/hechos/dimensiones";
import { limitesDePagina } from "@/lib/queries/hechos/dimensiones";

export type Expresiones<D extends string> = Record<D, SQLWrapper>;

export function condicionesDeFiltros<D extends Dimension>(
  dimensiones: Expresiones<D>,
  filtros: Filtros<D> | undefined,
): SQL | undefined {
  if (!filtros) return undefined;
  const entradas = Object.entries(filtros) as Array<[D, readonly (string | null)[] | undefined]>;
  const condiciones = entradas.flatMap(([nombre, valores]) => {
    if (!valores || valores.length === 0) return [];
    const expresion = dimensiones[nombre];
    const conNull = valores.includes(null);
    const textos = valores.filter((valor): valor is string => valor !== null);
    const condicionTextos = textos.length > 0 ? inArray(sql`${expresion}`, textos) : undefined;
    const condicionNull = conNull ? isNull(sql`${expresion}`) : undefined;
    return [or(condicionTextos, condicionNull)];
  });
  return and(...condiciones);
}

export function expresionDeOrden<C extends string>(
  columnas: Expresiones<C>,
  orden: Orden<C> | undefined,
): SQL | undefined {
  if (!orden) return undefined;
  return orden.sentido === "asc" ? asc(columnas[orden.campo]) : desc(columnas[orden.campo]);
}

export function seleccionarDimensiones<D extends Dimension>(
  dimensiones: Expresiones<D>,
  nombres: readonly D[],
): Record<string, SQLWrapper> {
  return Object.fromEntries(nombres.map((nombre) => [nombre, dimensiones[nombre]]));
}

export function aplicarPagina<T extends { limit: (limite: number) => T; offset: (offset: number) => T }>(
  consulta: T,
  pagina: Pagina | undefined,
): T {
  if (!pagina) return consulta;
  const { limite, offset } = limitesDePagina(pagina);
  return consulta.limit(limite).offset(offset);
}

export async function totalDeConsulta(db: Db, consulta: SQLWrapper): Promise<number> {
  const resultado = await db.execute<{ total: number }>(
    // La consulta recibida ya contiene exactamente el FROM/JOIN/WHERE de la lista.
    // Se envuelve, no se correlaciona con ninguna fila exterior.
    sql`select count(*)::int as total from (${consulta}) as filas`,
  );
  const filas = Array.isArray(resultado) ? resultado : resultado.rows;
  return Number(filas[0]?.total ?? 0);
}
