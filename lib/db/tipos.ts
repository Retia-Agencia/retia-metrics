import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

/**
 * Tipo comun de la base que sirve tanto para el cliente de produccion
 * (`drizzle-orm/node-postgres` contra Supabase, ADR 0047) como para el de los tests
 * (`drizzle-orm/pglite`, ADR 0020).
 *
 * Los dos soportan transacciones interactivas de verdad, asi que `ejecutarJuntas` ya
 * no tiene que distinguirlos: es el mismo camino en produccion y en los tests. Con
 * `neon-http` no era asi (produccion usaba `batch` y los tests `transaction`), y la
 * rama que corria en produccion era justo la que ningun test ejercia.
 */
export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;
