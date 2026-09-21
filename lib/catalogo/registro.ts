import type { ZodType } from "zod";
import type { Db } from "@/lib/db/tipos";
import type { Catalogo } from "./molde";
import { esquemaPlataformaPago, plataformasDePago } from "./plataformas";
import { esquemaMotivo, motivos } from "./motivos";
import { esquemaOrigen, origenes } from "./origenes";
import { categoriasDeRecurso, esquemaCategoriaRecurso } from "./categorias-recurso";

/**
 * Registro de catalogos de la pantalla `/ajustes/catalogos` (ticket 013, ADR 0012).
 *
 * Es la UNICA fuente de verdad de que catalogos administra la pantalla. Agregar un
 * catalogo nuevo (que ya cumpla el molde) es una sola linea aca: la pantalla, las
 * pestañas y las operaciones lo heredan sin tocar nada mas. Un test
 * (`tests/registro-catalogos.test.ts`) fija que aparezcan los tres del molde.
 */

/** La entrada minima comun a todos los catalogos del molde: un nombre. */
export interface EntradaCatalogo extends Record<string, unknown> {
  nombre: string;
}

export interface DefinicionCatalogo {
  /** Id opaco del catalogo en la URL y en el registro (no es un dato del negocio). */
  slug: string;
  /**
   * Si un closer tambien lo administra (enmienda del ticket 013, Mani 19 y 20-sep).
   *
   * Solo las plataformas de pago: un closer se topa con "necesito cobrar por un medio
   * que no esta" y no deberia esperar a un gerente. Los motivos de perdida y los
   * origenes del lead siguen siendo de administracion — son las etiquetas con las que
   * se mide a todo el equipo.
   *
   * Es una propiedad del CATALOGO, no un `rol === "closer"` escrito en la pantalla:
   * asi el developer nunca queda afuera (ADR 0025) y agregar un catalogo compartido
   * sigue siendo una linea de este registro.
   */
  compartidoConClosers: boolean;
  /**
   * Si sus filas se vinculan a programas por tabla puente (ADR 0034). Hoy tambien solo
   * las plataformas de pago.
   *
   * Es OTRA pregunta que `compartidoConClosers`, aunque hoy las dos den el mismo
   * catalogo: una dice QUIEN lo administra y la otra QUE FORMA tiene. Un catalogo
   * futuro puede ser compartido sin programas, o tener programas y ser de pura
   * administracion.
   */
  vinculadoAProgramas: boolean;
  /** Nombre visible de la pestaña, en español. */
  nombre: string;
  /** El unico esquema zod de la entidad (el mismo que usa el molde). */
  esquema: ZodType<EntradaCatalogo>;
  /** Fabrica del catalogo del molde; recibe la base (por defecto la de la app). */
  fabrica: (db?: Db) => Catalogo<EntradaCatalogo>;
}

export const REGISTRO_CATALOGOS: readonly DefinicionCatalogo[] = [
  {
    slug: "plataformas",
    vinculadoAProgramas: true,
    compartidoConClosers: true,
    nombre: "Plataformas de pago",
    esquema: esquemaPlataformaPago,
    fabrica: plataformasDePago,
  },
  {
    slug: "motivos",
    vinculadoAProgramas: false,
    compartidoConClosers: false,
    nombre: "Motivos de pérdida",
    esquema: esquemaMotivo,
    fabrica: motivos,
  },
  {
    slug: "origenes",
    vinculadoAProgramas: false,
    compartidoConClosers: false,
    nombre: "Orígenes del lead",
    esquema: esquemaOrigen,
    fabrica: origenes,
  },
  {
    slug: "categorias-recurso",
    vinculadoAProgramas: false,
    compartidoConClosers: false,
    nombre: "Categorías de recurso",
    esquema: esquemaCategoriaRecurso,
    fabrica: categoriasDeRecurso,
  },
];

/** Resuelve una definicion por su slug, o `undefined` si no existe. */
export function catalogoPorSlug(slug: string): DefinicionCatalogo | undefined {
  return REGISTRO_CATALOGOS.find((c) => c.slug === slug);
}
