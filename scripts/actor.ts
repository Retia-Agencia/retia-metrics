import { eq } from "drizzle-orm";
import { db as dbDeLaApp } from "../lib/db";
import { users } from "../lib/db/schema";
import type { Db } from "../lib/db/tipos";
import { esRolValido, type Rol } from "../lib/auth/roles";

/**
 * Quien ACTUA cuando la escritura la hace un script y no una pantalla (ADR 0029).
 *
 * Una fila de catalogo creada desde la terminal es una decision de una persona,
 * igual que si la hubiera creado desde la app: el molde de `lib/catalogo/` pide un
 * `userId` para escribir en `change_log`, y un script no tiene sesion de donde
 * sacarlo. Este modulo lo resuelve en UN solo lugar para que el proximo script no
 * vuelva a inventarse la respuesta (ni a saltarse el molde por no tenerla).
 *
 * El correo va por variable de entorno y no por argumento de linea de comandos a
 * proposito: un argumento se copia de un README y termina siendo siempre el mismo
 * correo de otra persona. `.env.local` es de quien esta sentado en la maquina.
 *
 * Solo se exige que el usuario EXISTA y este activo, no un rol. Quien puede crear
 * que cosa ya lo decide la funcion del catalogo que el script llama; lo que este
 * modulo garantiza es que la fila de `change_log` apunte a una persona real de
 * `users` y no a un uuid inventado.
 */
export async function actorDelScript(db: Db = dbDeLaApp): Promise<string> {
  const correo = process.env.SCRIPT_ACTOR_EMAIL?.trim().toLowerCase();
  if (!correo) {
    throw new Error(
      "Falta SCRIPT_ACTOR_EMAIL en .env.local. Un script que escribe en una base " +
        "viva tiene que decir QUIEN esta actuando: ese correo es el que queda en " +
        "change_log (ADR 0029). Pon el tuyo, el mismo con el que entras a la app.",
    );
  }

  const [fila] = await db
    .select({ id: users.id, activo: users.activo })
    .from(users)
    .where(eq(users.email, correo))
    .limit(1);

  if (!fila) {
    throw new Error(
      `SCRIPT_ACTOR_EMAIL apunta a "${correo}", que no existe en la tabla de usuarios ` +
        "de ESTA base. Comprueba que estas apuntando a la base que crees (dev y " +
        "production tienen usuarios distintos) y que el correo esta dado de alta.",
    );
  }
  if (!fila.activo) {
    throw new Error(
      `El usuario "${correo}" esta inactivo. Un usuario que no puede entrar a la app ` +
        "tampoco deberia aparecer en change_log como autor de un cambio de hoy.",
    );
  }

  return fila.id;
}

/**
 * El actor de un script CON su rol, para las funciones de catalogo que ya no reciben
 * solo un `userId` sino un `{ id, rol }` (recursos y enlaces de pago, tras la enmienda
 * del 19-sep que abrio su creacion al closer con la regla de acceso por programa del
 * ADR 0016).
 *
 * El `id` sigue siendo el que queda en `change_log` (ADR 0029). El `rol` solo decide
 * el acceso por programa: un script de carga masiva lo corre quien administra, asi que
 * su rol real (gerente o developer) pasa la regla para todos los programas. Si algun
 * dia lo corriera un closer, quedaria acotado a sus programas, que es lo correcto.
 */
export async function actorConRolDelScript(
  db: Db = dbDeLaApp,
): Promise<{ id: string; rol: Rol }> {
  const id = await actorDelScript(db);
  const [fila] = await db.select({ rol: users.rol }).from(users).where(eq(users.id, id)).limit(1);
  if (!fila || !esRolValido(fila.rol)) {
    throw new Error(
      "El actor del script tiene un rol no reconocido. Revisa la fila en `users`.",
    );
  }
  return { id, rol: fila.rol };
}
