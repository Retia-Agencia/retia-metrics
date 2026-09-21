import { and, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { changeLog } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * TODA escritura del CRM deja rastro, y el rastro se escribe desde el dia uno
 * (ADR 0042, decision D6 del plan v2).
 *
 * Cubre las cuatro tablas OPERATIVAS —`deals`, `calls`, `abonos` y
 * `deal_actividades`—, no solo el catalogo, que es lo que `lib/catalogo/molde.ts`
 * ya cubria. Es el mismo molde con otra forma: aqui no hay columna `activo`, asi
 * que no hay desactivar ni borrar; una fila operativa se ANULA (ADR 0026).
 *
 * ## Por que existe AHORA y no "de lo ultimo"
 *
 * Mani dijo *"eso puede ser de lo ultimo que configuramos"*. Lo ultimo es la
 * PANTALLA (ticket 076); el rastro va primero, y la razon no es una preferencia:
 * **si se retrofitea al final, todo lo escrito antes no tiene historia y no hay
 * manera honesta de fabricarla.**
 *
 * 🩸 Ya paso exacto en esta misma base: los 5 enlaces de PayPal entraron a
 * `production` el 18-sep con `change_log` en 0, y siguen sin rastro a proposito,
 * porque un historial de auditoria fabricado se ve identico al de verdad. Dentro
 * de tres meses, "¿quien puso estos links?" no tiene respuesta.
 *
 * ## Las tres garantias
 *
 * 1. **La escritura y su fila de `change_log` van en la MISMA operacion**
 *    (`ejecutarJuntas`). No hay forma de escribir sin que quede registrado; no hay
 *    que acordarse de registrar.
 * 2. **El quien sale de la sesion, nunca del input.** Este modulo recibe el
 *    `actorId` como parametro aparte y jamas lo lee de los valores: un `id` metido
 *    en el cuerpo de la peticion se ignora porque ni siquiera se mira. Desde un
 *    script el actor lo da `actorDelScript()` (ADR 0029), que se niega a arrancar
 *    sin `SCRIPT_ACTOR_EMAIL`.
 * 3. **Un guardian** (`tests/rastro-operativo.test.ts`) recorre `lib/`, `app/`,
 *    `components/` y `scripts/` y falla si aparece un `insert`/`update` sobre esas
 *    cuatro tablas fuera de aqui.
 *
 * ## Lo que NO pasa por aca
 *
 * El movimiento de etapa. Tiene su propia tabla, `deal_etapa_historial` (ADR 0037),
 * porque no es "un campo cambio de X a Y" sino el hecho central del que salen la
 * conversion y el tiempo en etapa. Duplicarlo en los dos rastros crearia la
 * divergencia que el invariante 1 del plan prohibe.
 */

/** Las cuatro tablas operativas, por su nombre en la base. Es lo que vigila el guardian. */
export const TABLAS_CON_RASTRO = ["deals", "calls", "abonos", "deal_actividades"] as const;

export type TablaConRastro = (typeof TABLAS_CON_RASTRO)[number];

/**
 * Como se escribe un valor en `change_log`. Mismo criterio que el molde de catalogo:
 * texto plano, y `null` para lo ausente. La bitacora se LEE, no se re-parsea.
 */
function aTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  return String(valor);
}

interface Contexto {
  db: Db;
  /** La tabla de drizzle sobre la que se escribe. */
  tabla: PgTable;
  /** Su nombre en la base, el que queda en `change_log.tabla`. */
  nombreTabla: TablaConRastro;
  /** Quien escribe. Sale SIEMPRE de la sesion; `null` = lo hizo el sync. */
  actorId: string | null;
  /**
   * Etiqueta legible del registro, para no tener que hacer join al mostrar la
   * bitacora. La arma el llamador, que es quien sabe como se nombra su entidad.
   */
  etiqueta: string;
}

/**
 * Crea una fila operativa y su rastro, en una sola operacion.
 *
 * Una fila de `change_log` por CAMPO escrito, igual que `molde.crear`. Lo que llego
 * vacio no se registra: "este campo nacio nulo" no es un cambio, y llenar la
 * bitacora de nulos la vuelve ilegible justo el dia que hay que leerla.
 */
export async function crearConRastro(
  ctx: Contexto,
  valores: Record<string, unknown>,
): Promise<string> {
  const { db, tabla, nombreTabla, actorId, etiqueta } = ctx;
  // El id se genera en codigo para meter el alta y su bitacora en el mismo lote:
  // `ejecutarJuntas` no deja encadenar el id recien insertado.
  const id = crypto.randomUUID();

  const aRegistrar = Object.entries(valores).filter(
    ([campo, valor]) => campo !== "id" && valor !== null && valor !== undefined,
  );

  await ejecutarJuntas(db, (tx) => [
    (tx as Db).insert(tabla as never).values({ id, ...valores } as never),
    ...aRegistrar.map(([campo, valor]) =>
      (tx as Db).insert(changeLog).values({
        tabla: nombreTabla,
        registroId: id,
        etiqueta,
        campo,
        valorAnterior: null,
        valorNuevo: aTexto(valor),
        origen: "app" as const,
        userId: actorId,
      }),
    ),
  ]);

  return id;
}

/**
 * Edita una fila operativa y deja rastro SOLO de lo que cambio.
 *
 * 🎯 Esta es la decision que el ticket 041 dejaba abierta: **cuanto del "antes" se
 * guarda**. Se guardan los CAMPOS TOCADOS, una fila por campo, con su valor
 * anterior y el nuevo.
 *
 * Guardar la fila entera en cada edicion es caro y, peor, ilegible: la pregunta
 * que alguien hace tres meses despues es "¿quien cambio el producto de este deal?",
 * y una copia completa de la fila obliga a diffear a mano para contestarla. Guardar
 * solo un "se edito" pierde el dato. El campo tocado con sus dos valores es lo
 * unico que contesta la pregunta directamente, y es ademas la forma que
 * `change_log` ya tiene desde el ADR 0012: una cuarta forma de decir lo mismo seria
 * la divergencia que el invariante 1 del plan prohibe.
 *
 * **Si nada cambio no se toca la fila ni se escribe bitacora**, igual que
 * `molde.editar`: un `update` que no cambia nada no es un hecho, y registrarlo
 * llenaria la bitacora de ruido que esconde los cambios de verdad.
 */
export async function editarConRastro(
  ctx: Contexto,
  id: string,
  valores: Record<string, unknown>,
): Promise<boolean> {
  const { db, tabla, nombreTabla, actorId, etiqueta } = ctx;
  const columnas = tabla as unknown as Record<string, unknown>;
  const idCol = columnas.id as never;

  // `incluyendoAnulados` y no `vigente`: esto NO es una metrica, es "dame la fila
  // que estoy a punto de escribir", y se busca por clave primaria. Tiene que verla
  // este como este — si un registro anulado se puede editar o no es una regla del
  // llamador (hoy: no se edita, se corrige el vivo), no de la lectura que arma el
  // diff. Escribirlo con su nombre deja la decision en el grep y no en la memoria.
  const [actual] = (await db
    .select()
    .from(tabla)
    .where(and(eq(idCol, id), incluyendoAnulados(tabla)))) as Record<string, unknown>[];
  if (!actual) throw new ErrorDeApp("No existe el registro que se quiere editar.", 404);

  const cambiados = Object.entries(valores).filter(
    ([campo, valor]) => aTexto(actual[campo]) !== aTexto(valor),
  );
  if (cambiados.length === 0) return false;

  await ejecutarJuntas(db, (tx) => [
    (tx as Db)
      .update(tabla as never)
      .set(valores as never)
      .where(eq(idCol, id)),
    ...cambiados.map(([campo, valor]) =>
      (tx as Db).insert(changeLog).values({
        tabla: nombreTabla,
        registroId: id,
        etiqueta,
        campo,
        valorAnterior: aTexto(actual[campo]),
        valorNuevo: aTexto(valor),
        origen: "app" as const,
        userId: actorId,
      }),
    ),
  ]);

  return true;
}
