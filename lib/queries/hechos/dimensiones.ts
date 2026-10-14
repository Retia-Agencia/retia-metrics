import type { Rango } from "@/lib/queries/dashboard";

export type Dimension = string;
export type ValorFiltro = string | null;
export type Filtros<D extends Dimension> = Partial<Record<D, readonly ValorFiltro[]>>;

export interface Orden<C extends string> {
  campo: C;
  sentido: "asc" | "desc";
}

export type Pagina =
  | { limite: number; offset: number }
  | { numero: number; tamano: number };

export interface AlcanceDeHecho {
  programId: string;
  rango: Rango;
}

export interface ConsultaAgrupada<D extends Dimension, C extends string> extends AlcanceDeHecho {
  agruparPor: readonly D[];
  filtros?: Filtros<D>;
  orden?: Orden<C>;
  pagina?: Pagina;
}

export interface ConsultaDeLista<D extends Dimension, C extends string> extends AlcanceDeHecho {
  filtros?: Filtros<D>;
  orden?: Orden<C>;
  pagina: Pagina;
}

export interface ListaPaginada<Fila> {
  filas: Fila[];
  total: number;
}

export function limitesDePagina(pagina: Pagina): { limite: number; offset: number } {
  if ("limite" in pagina) return pagina;
  return { limite: pagina.tamano, offset: Math.max(0, pagina.numero - 1) * pagina.tamano };
}
