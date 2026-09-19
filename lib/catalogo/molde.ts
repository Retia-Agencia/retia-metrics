import { eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { changeLog } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { esViolacionUnica } from "@/lib/db/errores";

/**
 * El molde de toda entidad configurable (ADR 0012).
 *
 * Dada una tabla de Drizzle (que DEBE tener columnas `id` y `activo`) y un unico
 * esquema zod, devuelve las operaciones del contrato: `listar`, `crear`, `editar`,
 * `desactivar` y `reactivar`. El molde no conoce ninguna entidad concreta: no hay
 * literales de programa, plataforma ni nada del negocio aca dentro.
 *
 * Toda escritura deja rastro en `change_log` (una fila por campo que cambia) con
 * `origen = "app"` y el `userId` de quien la hizo. Nunca se borra una fila: se
 * desactiva (`activo = false`).
 */

/** Forma minima de una fila de catalogo: el molde solo asume estas dos columnas. */
export interface FilaCatalogo {
  id: string;
  activo: boolean;
  [columna: string]: unknown;
}

export interface OpcionesMolde<Entrada extends Record<string, unknown>> {
  /** La tabla de Drizzle. Debe tener columnas `id` (uuid) y `activo` (boolean). */
  tabla: PgTable;
  /** Nombre real de la tabla en la base; se guarda en `change_log.tabla`. */
  nombreTabla: string;
  /** El unico esquema zod de la entidad. Valida la entrada de crear y editar. */
  esquema: ZodType<Entrada>;
  /** Etiqueta legible de una fila, para no tener que hacer join al mostrar el log. */
  etiqueta: (fila: FilaCatalogo) => string;
  /** Nombre de la entidad en singular, para los mensajes de error ("plataforma de pago"). */
  nombreEntidad: string;
}

export interface Catalogo<Entrada extends Record<string, unknown>> {
  listar: (opciones?: { soloActivos?: boolean }) => Promise<FilaCatalogo[]>;
  // La entrada se tipa con `Entrada` para el llamador, pero SIEMPRE se revalida en
  // runtime con el esquema zod dentro del molde (defensa de borde, ADR 0012).
  crear: (userId: string, input: Entrada) => Promise<FilaCatalogo>;
  editar: (userId: string, id: string, input: Entrada) => Promise<FilaCatalogo>;
  desactivar: (userId: string, id: string) => Promise<FilaCatalogo>;
  reactivar: (userId: string, id: string) => Promise<FilaCatalogo>;
}

/** Convierte un valor de columna a texto para `change_log` (que guarda todo como texto). */
function aTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return String(valor);
}

export function moldeDeCatalogo<Entrada extends Record<string, unknown>>(
  opciones: OpcionesMolde<Entrada>,
  db: Db = dbDeLaApp,
): Catalogo<Entrada> {
  const { tabla, nombreTabla, esquema, etiqueta, nombreEntidad } = opciones;

  // La tabla es generica; internamente sacamos de ella las columnas id y activo
  // para construir where/update sin conocer la entidad.
  const columnas = tabla as unknown as Record<string, unknown>;
  const idCol = columnas.id as never;
  const activoCol = columnas.activo as never;

  async function leerFila(id: string): Promise<FilaCatalogo | undefined> {
    const filas = await db
      .select()
      .from(tabla as never)
      .where(eq(idCol, id));
    return filas[0] as FilaCatalogo | undefined;
  }

  const mensajeDuplicado = `Ya existe ${nombreEntidad} con ese nombre.`;

  return {
    async listar(opcionesListar) {
      const query = db.select().from(tabla as never);
      const filas = opcionesListar?.soloActivos
        ? await query.where(eq(activoCol, true as never))
        : await query;
      return filas as FilaCatalogo[];
    },

    async crear(userId, input) {
      // El ZodError sale tal cual: respuestaDeError ya lo convierte en 400.
      const datos = esquema.parse(input) as Record<string, unknown>;
      // El id se genera en codigo para poder meter el alta y su change_log en el
      // mismo lote (batch no deja encadenar el id recien insertado).
      const id = crypto.randomUUID();
      const etiquetaFila = etiqueta({ id, activo: true, ...datos } as FilaCatalogo);

      try {
        await ejecutarJuntas(db, (tx) => [
          (tx as Db).insert(tabla as never).values({ id, ...datos } as never),
          ...Object.entries(datos).map(([campo, valor]) =>
            (tx as Db).insert(changeLog).values({
              tabla: nombreTabla,
              registroId: id,
              etiqueta: etiquetaFila,
              campo,
              valorAnterior: null,
              valorNuevo: aTexto(valor),
              origen: "app" as const,
              userId,
            }),
          ),
        ]);
      } catch (error) {
        if (esViolacionUnica(error)) throw new ErrorDeApp(mensajeDuplicado, 409);
        throw error;
      }

      return (await leerFila(id))!;
    },

    async editar(userId, id, input) {
      // Esquema completo (no parcial): la entrada de una edicion tiene la misma
      // forma que la de un alta. Que se registre solo lo que cambio lo decide el
      // diff de abajo, no un esquema laxo. Asi hay un solo esquema por entidad
      // (ADR 0012) y una sola validacion.
      const datos = esquema.parse(input) as Record<string, unknown>;
      const actual = await leerFila(id);
      if (!actual) throw new ErrorDeApp(`No existe ${nombreEntidad} con ese id.`, 404);

      const cambiados = Object.entries(datos).filter(
        ([campo, valor]) => aTexto(actual[campo]) !== aTexto(valor),
      );
      // Nada cambio: no se toca la fila ni se escribe en change_log.
      if (cambiados.length === 0) return actual;

      const etiquetaFila = etiqueta({ ...actual, ...datos } as FilaCatalogo);
      try {
        await ejecutarJuntas(db, (tx) => [
          (tx as Db)
            .update(tabla as never)
            .set(datos as never)
            .where(eq(idCol, id)),
          ...cambiados.map(([campo, valor]) =>
            (tx as Db).insert(changeLog).values({
              tabla: nombreTabla,
              registroId: id,
              etiqueta: etiquetaFila,
              campo,
              valorAnterior: aTexto(actual[campo]),
              valorNuevo: aTexto(valor),
              origen: "app" as const,
              userId,
            }),
          ),
        ]);
      } catch (error) {
        if (esViolacionUnica(error)) throw new ErrorDeApp(mensajeDuplicado, 409);
        throw error;
      }

      return (await leerFila(id))!;
    },

    async desactivar(userId, id) {
      const actual = await leerFila(id);
      if (!actual) throw new ErrorDeApp(`No existe ${nombreEntidad} con ese id.`, 404);
      // Ya estaba inactiva: no se escribe nada (ni fila ni change_log).
      if (!actual.activo) return actual;

      const etiquetaFila = etiqueta(actual);
      await ejecutarJuntas(db, (tx) => [
        (tx as Db)
          .update(tabla as never)
          .set({ activo: false } as never)
          .where(eq(idCol, id)),
        (tx as Db).insert(changeLog).values({
          tabla: nombreTabla,
          registroId: id,
          etiqueta: etiquetaFila,
          campo: "activo",
          valorAnterior: "true",
          valorNuevo: "false",
          origen: "app" as const,
          userId,
        }),
      ]);

      return (await leerFila(id))!;
    },

    async reactivar(userId, id) {
      const actual = await leerFila(id);
      if (!actual) throw new ErrorDeApp(`No existe ${nombreEntidad} con ese id.`, 404);
      // Ya estaba activa: no se escribe nada (ni fila ni change_log). Simetrico a
      // `desactivar`: reactivar es la misma operacion en el otro sentido.
      if (actual.activo) return actual;

      const etiquetaFila = etiqueta(actual);
      await ejecutarJuntas(db, (tx) => [
        (tx as Db)
          .update(tabla as never)
          .set({ activo: true } as never)
          .where(eq(idCol, id)),
        (tx as Db).insert(changeLog).values({
          tabla: nombreTabla,
          registroId: id,
          etiqueta: etiquetaFila,
          campo: "activo",
          valorAnterior: "false",
          valorNuevo: "true",
          origen: "app" as const,
          userId,
        }),
      ]);

      return (await leerFila(id))!;
    },
  };
}
