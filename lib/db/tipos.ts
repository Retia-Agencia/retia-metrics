import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

/**
 * Tipo comun de la base que sirve tanto para el cliente de produccion
 * (`drizzle-orm/neon-http`) como para el de los tests (`drizzle-orm/pglite`).
 *
 * Ambos extienden `PgDatabase`, asi que todo el molde de catalogo (select,
 * insert, update) esta tipado igual en los dos. La union se usa a proposito en
 * vez del tipo comun `PgDatabase<...>` para que `ejecutarJuntas` pueda distinguir
 * cual soporta `batch` (neon-http) y cual `transaction` (pglite): ver
 * `lib/db/ejecutar-juntas.ts`.
 */
export type Db = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;
