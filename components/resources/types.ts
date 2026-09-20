export type MapeoColumnas = Record<string, string | string[]>;

export interface RecursoUI {
  id: string;
  titulo: string;
  url: string;
  categoriaNombre: string | null;
  programaNombre: string | null;
  /** Versiones anteriores, de la mas reciente a la mas vieja. */
  historial: { id: string; url: string }[];
}

export interface EnlaceUI {
  id: string;
  url: string;
  monto: string;
  moneda: string;
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
}
