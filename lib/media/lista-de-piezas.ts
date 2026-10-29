import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { creadores, piezas, tiposPieza } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";
import { condicionDeEstado, esEstadoDePieza, type EstadoDePieza } from "./estado-de-pieza";
import { esRedDeContenido } from "./redes";

/**
 * La lista de piezas de /media (ticket 321): filtros, orden y pagina, todo en SQL (contrato C-2,
 * docs/hub.md §8). El programa es frontera: la lista solo ve piezas de los creadores que le
 * pasa la pagina (`creadorIds`, ya filtrados por alcance y programa), y un `creador` de la URL
 * que no este ahi se ignora. Los parametros de la URL se validan contra listas blancas: un
 * valor raro vuelve al default, nunca llega a la consulta.
 */
export const ORDENES_DE_PIEZAS = [
  { value: "creada:desc", label: "Creación: más reciente" },
  { value: "creada:asc", label: "Creación: más antigua" },
  { value: "fecha:desc", label: "Publicación: más reciente" },
  { value: "fecha:asc", label: "Publicación: más antigua" },
  { value: "nombre:asc", label: "Nombre: A → Z" },
  { value: "nombre:desc", label: "Nombre: Z → A" },
  { value: "creador:asc", label: "Creador: A → Z" },
  { value: "creador:desc", label: "Creador: Z → A" },
] as const;
export type OrdenDePiezas = (typeof ORDENES_DE_PIEZAS)[number]["value"];
export const ORDEN_DE_PIEZAS_POR_DEFECTO: OrdenDePiezas = "creada:desc";
export const PIEZAS_POR_PAGINA = 15;

export interface FiltroDePiezas {
  estado: EstadoDePieza | null;
  creadorId: string | null;
  tipoId: string | null;
  red: string | null;
  q: string;
  orden: OrdenDePiezas;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Parametros = Record<string, string | string[] | undefined>;

/** Una sola interpretacion de los filtros guardados en la URL de /media. */
export function filtroDePiezasDesdeUrl(parametros: Parametros): FiltroDePiezas {
  const uno = (nombre: string) => {
    const v = parametros[nombre];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const orden = ORDENES_DE_PIEZAS.find((o) => o.value === uno("orden"))?.value ?? ORDEN_DE_PIEZAS_POR_DEFECTO;
  return {
    estado: esEstadoDePieza(uno("estado")) ? (uno("estado") as EstadoDePieza) : null,
    creadorId: UUID.test(uno("creador")) ? uno("creador") : null,
    tipoId: UUID.test(uno("tipo")) ? uno("tipo") : null,
    red: esRedDeContenido(uno("red")) ? uno("red") : null,
    q: uno("q").trim().slice(0, 80),
    orden,
  };
}

export function hayFiltroActivo(f: FiltroDePiezas): boolean {
  return f.estado !== null || f.creadorId !== null || f.tipoId !== null || f.red !== null || f.q !== "";
}

function ordenSql(orden: OrdenDePiezas): SQL[] {
  const desempate = [desc(piezas.createdAt), asc(piezas.id)];
  switch (orden) {
    case "creada:desc": return desempate;
    case "creada:asc": return [asc(piezas.createdAt), asc(piezas.id)];
    // Las siempre visibles no tienen fecha: van al final en los dos sentidos.
    case "fecha:desc": return [sql`${piezas.fechaPublicacion} desc nulls last`, ...desempate];
    case "fecha:asc": return [sql`${piezas.fechaPublicacion} asc nulls last`, ...desempate];
    case "nombre:asc": return [asc(piezas.nombre), ...desempate];
    case "nombre:desc": return [desc(piezas.nombre), ...desempate];
    case "creador:asc": return [asc(creadores.nombre), ...desempate];
    case "creador:desc": return [desc(creadores.nombre), ...desempate];
  }
}

/** Escapa `%`, `_` y `\` para que el texto buscado se lea literal dentro de un ILIKE. */
function comoLiteral(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function piezasDeMedia(
  db: Db,
  creadorIds: string[],
  filtro: FiltroDePiezas,
  hoy: string,
  pagina: number,
) {
  if (creadorIds.length === 0) return { filas: [], total: 0, paginas: 1, pagina: 1 };
  const patron = filtro.q ? `%${comoLiteral(filtro.q)}%` : null;
  // El predicado de vigencia va en CADA cadena, no izado: el guardian del ADR 0026 lee cadena por cadena.
  const condiciones = [
    inArray(piezas.creadorId, filtro.creadorId && creadorIds.includes(filtro.creadorId) ? [filtro.creadorId] : creadorIds),
    filtro.estado ? condicionDeEstado(filtro.estado, hoy) : undefined,
    filtro.tipoId ? eq(piezas.tipoId, filtro.tipoId) : undefined,
    filtro.red ? eq(piezas.red, filtro.red) : undefined,
    patron ? or(ilike(piezas.nombre, patron), ilike(creadores.nombre, patron), ilike(tiposPieza.nombre, patron)) : undefined,
  ];
  const [{ n: total }] = await db
    .select({ n: count() })
    .from(piezas)
    .innerJoin(creadores, eq(creadores.id, piezas.creadorId))
    .innerJoin(tiposPieza, eq(tiposPieza.id, piezas.tipoId))
    .where(and(vigente(piezas), ...condiciones));
  const paginas = Math.max(1, Math.ceil(total / PIEZAS_POR_PAGINA));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const filas = await db
    .select({ pieza: piezas })
    .from(piezas)
    .innerJoin(creadores, eq(creadores.id, piezas.creadorId))
    .innerJoin(tiposPieza, eq(tiposPieza.id, piezas.tipoId))
    .where(and(vigente(piezas), ...condiciones))
    .orderBy(...ordenSql(filtro.orden))
    .limit(PIEZAS_POR_PAGINA)
    .offset((actual - 1) * PIEZAS_POR_PAGINA);
  return { filas: filas.map((f) => f.pieza), total, paginas, pagina: actual };
}
