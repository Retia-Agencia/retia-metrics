import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import {
  categoriasRecurso,
  enlacesPago,
  plataformasPago,
  productos,
  programs,
  recursos,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Lecturas de la pantalla `/recursos` (ticket 023, ADR 0017). Solo SELECT: lo que
 * escribe ya vive en `lib/catalogo/{recursos,enlaces-pago}.ts` (ticket 022). La base
 * entra por inyeccion (por defecto la de la app) para correr los tests sobre PGlite,
 * igual que `lib/queries/personas.ts`.
 *
 * Este modulo existe porque el `listar` del molde devuelve filas SIN joins: la
 * pantalla necesita el NOMBRE de la categoria y del programa ya resueltos (nunca
 * uuids), el filtro por programa que SIEMPRE incluye los globales, la busqueda por
 * titulo y el historial de versiones. El molde no expresa nada de eso.
 *
 * Sobre el historial (`historialDeRecurso`): se resuelve CAMINANDO la cadena de
 * `reemplazaA`, no consultando por la clave (programa, categoria, titulo). La cadena
 * es la fuente autoritativa —cada version apunta exactamente a la que reemplazo— y
 * sobrevive a una edicion: si a un recurso se le corrige el titulo o la categoria con
 * `editarRecurso`, la clave cambia y agrupar por clave partiria el historial en dos,
 * mientras que la cadena de punteros sigue intacta. La cadena es corta (una version
 * por reemplazo manual) y los historiales de la pantalla se cargan en bulk para no
 * convertir una lista de recursos en un N+1.
 */

/** Filtro de la pantalla: programa (opcional) y texto del titulo (opcional). */
export interface FiltroRecursos {
  /** Id del programa. Ausente = "Todos": trae todos los programas y los globales. */
  programId?: string;
  /** Texto a buscar en el titulo (ILIKE, insensible a mayusculas). */
  q?: string;
}

/** Un recurso vigente como lo muestra la pantalla, con los nombres ya resueltos. */
export interface RecursoDeLaPantalla {
  id: string;
  titulo: string;
  url: string;
  categoriaId: string;
  categoriaNombre: string | null;
  /** Nulo = recurso global (sirve para todos los programas). */
  programId: string | null;
  /** Nulo cuando el recurso es global. */
  programaNombre: string | null;
}

/** Cuantas caracteres exige la busqueda antes de aplicar el ILIKE. */
const MINIMO_TEXTO = 1;

/** Escapa los comodines de LIKE para que un `%` o `_` no se lea como patron. */
function patronDe(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Recursos VIGENTES y activos, con el nombre de su categoria y de su programa ya
 * resueltos (nunca uuids). Un `programId` en el filtro trae los de ese programa Y
 * los globales (`program_id IS NULL`): un recurso global sirve para todos y debe
 * aparecer con cualquier filtro. Sin `programId` trae todos.
 */
export async function recursosVigentes(
  filtro: FiltroRecursos = {},
  db: Db = dbDeLaApp,
): Promise<RecursoDeLaPantalla[]> {
  const condiciones = [eq(recursos.vigente, true), eq(recursos.activo, true)];

  if (filtro.programId) {
    // El programa pedido O los globales: un global aparece con cualquier filtro.
    condiciones.push(or(eq(recursos.programId, filtro.programId), isNull(recursos.programId))!);
  }

  const termino = filtro.q?.trim() ?? "";
  if (termino.length >= MINIMO_TEXTO) {
    condiciones.push(ilike(recursos.titulo, patronDe(termino)));
  }

  return db
    .select({
      id: recursos.id,
      titulo: recursos.titulo,
      url: recursos.url,
      categoriaId: recursos.categoriaId,
      categoriaNombre: categoriasRecurso.nombre,
      programId: recursos.programId,
      programaNombre: programs.nombre,
    })
    .from(recursos)
    // El programa entra por leftJoin: un recurso global no tiene programa y debe
    // salir igual. La categoria es obligatoria, pero se deja leftJoin por simetria.
    .leftJoin(categoriasRecurso, eq(categoriasRecurso.id, recursos.categoriaId))
    .leftJoin(programs, eq(programs.id, recursos.programId))
    .where(and(...condiciones))
    .orderBy(asc(recursos.titulo));
}

/** Un enlace de pago vigente como lo muestra la pantalla, con los nombres resueltos. */
export interface EnlaceDeLaPantalla {
  id: string;
  url: string;
  monto: string;
  moneda: string;
  programId: string;
  programaNombre: string | null;
  productoId: string | null;
  /** Nulo cuando el enlace no corresponde a un producto del catalogo. */
  productoNombre: string | null;
  plataformaId: string;
  plataformaNombre: string | null;
}

/**
 * Enlaces de pago VIGENTES y activos, con su programa, producto (puede ser nulo),
 * plataforma, monto y moneda ya resueltos. El filtro por programa NO arrastra
 * globales: un enlace de pago siempre tiene programa (la columna es `NOT NULL`).
 */
export async function enlacesDePagoVigentes(
  filtro: { programId?: string } = {},
  db: Db = dbDeLaApp,
): Promise<EnlaceDeLaPantalla[]> {
  const condiciones = [eq(enlacesPago.vigente, true), eq(enlacesPago.activo, true)];
  if (filtro.programId) condiciones.push(eq(enlacesPago.programId, filtro.programId));

  return db
    .select({
      id: enlacesPago.id,
      url: enlacesPago.url,
      monto: enlacesPago.monto,
      moneda: enlacesPago.moneda,
      programId: enlacesPago.programId,
      programaNombre: programs.nombre,
      productoId: enlacesPago.productoId,
      productoNombre: productos.nombre,
      plataformaId: enlacesPago.plataformaId,
      plataformaNombre: plataformasPago.nombre,
    })
    .from(enlacesPago)
    .leftJoin(programs, eq(programs.id, enlacesPago.programId))
    .leftJoin(productos, eq(productos.id, enlacesPago.productoId))
    .leftJoin(plataformasPago, eq(plataformasPago.id, enlacesPago.plataformaId))
    .where(and(...condiciones))
    .orderBy(asc(enlacesPago.monto));
}

/** Una version anterior de un recurso, como la muestra el historial desplegable. */
export interface VersionDeRecurso {
  id: string;
  url: string;
  /** Cuando se creo esa version; el orden real lo da la cadena, esto es informativo. */
  createdAt: Date;
}

type FilaDeHistorial = {
  id: string;
  url: string;
  createdAt: Date;
  reemplazaA: string | null;
};

/** Carga los historiales pedidos en una sola consulta y sigue las cadenas en memoria. */
export async function historialesDeRecursos(
  ids: string[],
  db: Db = dbDeLaApp,
): Promise<Map<string, VersionDeRecurso[]>> {
  const resultado = new Map<string, VersionDeRecurso[]>();
  if (ids.length === 0) return resultado;

  const porId = new Map<string, FilaDeHistorial>();
  let pendientes = new Set(ids);
  while (pendientes.size > 0) {
    const filas = await db
      .select({
        id: recursos.id,
        url: recursos.url,
        createdAt: recursos.createdAt,
        reemplazaA: recursos.reemplazaA,
      })
      .from(recursos)
      .where(inArray(recursos.id, [...pendientes]));
    const siguientes = new Set<string>();
    for (const fila of filas) {
      porId.set(fila.id, fila);
      if (fila.reemplazaA && !porId.has(fila.reemplazaA)) {
        siguientes.add(fila.reemplazaA);
      }
    }
    if (filas.length === 0) break;
    pendientes = siguientes;
  }

  for (const id of ids) {
    const versiones: VersionDeRecurso[] = [];
    let siguiente = porId.get(id)?.reemplazaA ?? null;
    const vistos = new Set<string>();

    while (siguiente && !vistos.has(siguiente)) {
      vistos.add(siguiente);
      const fila = porId.get(siguiente);
      if (!fila) break;
      versiones.push({ id: fila.id, url: fila.url, createdAt: fila.createdAt });
      siguiente = fila.reemplazaA;
    }
    resultado.set(id, versiones);
  }

  return resultado;
}

/**
 * Las versiones ANTERIORES de un recurso, de la mas reciente a la mas vieja, caminando
 * la cadena de `reemplazaA` desde el id dado. No incluye la version consultada.
 *
 * Se camina la cadena en vez de consultar por la clave (programa, categoria, titulo)
 * porque la cadena sobrevive a una edicion del titulo o la categoria; ver el comentario
 * de cabecera del modulo. Un tope defensivo evita un ciclo si los datos estuvieran
 * corruptos (la base garantiza que no, pero un `while(true)` sobre datos no es sano).
 */
export async function historialDeRecurso(
  id: string,
  db: Db = dbDeLaApp,
): Promise<VersionDeRecurso[]> {
  return (await historialesDeRecursos([id], db)).get(id) ?? [];
}
