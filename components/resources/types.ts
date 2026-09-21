export type MapeoColumnas = Record<string, string | string[]>;

export interface RecursoUI {
  id: string;
  titulo: string;
  url: string;
  categoriaNombre: string | null;
  /** Nulo = recurso global. Decide si un closer puede editarlo (solo sus programas). */
  programId: string | null;
  programaNombre: string | null;
  /** Versiones anteriores, de la mas reciente a la mas vieja. */
  historial: { id: string; url: string }[];
}

export interface EnlaceUI {
  id: string;
  url: string;
  monto: string;
  moneda: string;
  /** Siempre presente (la columna es NOT NULL). Decide si un closer puede editarlo. */
  programId: string;
  programaNombre: string | null;
  productoNombre: string | null;
  plataformaNombre: string | null;
}

export interface ProgramaOpcion {
  id: string;
  slug: string;
  nombre: string;
}

export interface CategoriaOpcion {
  id: string;
  nombre: string;
}

export interface PlataformaOpcion {
  id: string;
  nombre: string;
  /** Los programas a los que sirve (ADR 0034). El selector se acota con esto. */
  programas: string[];
}
