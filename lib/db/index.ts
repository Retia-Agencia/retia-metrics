import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type DB = ReturnType<typeof crear>;

let instancia: DB | null = null;

function crear() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y pon la connection string del " +
        "pooler de Supabase (puerto 6543).",
    );
  }
  // Supabase (ADR 0047). La app entra por el pooler en modo *transaction* (puerto 6543),
  // que es el que aguanta funciones serverless abriendo y cerrando conexiones. Ese modo
  // NO admite prepared statements: sin `prepare: false`, la segunda consulta que reuse
  // un statement revienta con "prepared statement does not exist" — y solo en
  // produccion, porque PGlite no pasa por ningun pooler.
  const cliente = postgres(connectionString, { prepare: false });
  return drizzle(cliente, { schema });
}

/**
 * Cliente perezoso: se crea en el primer uso, no al importar el modulo.
 *
 * Fallar ruidosamente sin DATABASE_URL es correcto y se mantiene. Lo que cambia es
 * *cuando*: antes cualquier archivo que importara este modulo —aunque fuera solo
 * para un tipo— reventaba al cargarse. De ahi salia el requisito de que
 * `scripts/load-env.ts` fuera el primer import de todos los scripts, una regla
 * sostenida por convencion y por un parrafo de documentacion, que se rompia sola el
 * dia que alguien agregara un import mas arriba sin saber. Tambien hacia que
 * `npm run build` fallara al recolectar datos de pagina en una maquina sin
 * `.env.local`, aunque ninguna pagina llegara a consultar nada.
 *
 * El error sigue llegando en el primer query, que es donde de verdad hace falta.
 *
 * ⚠️ `postgres-js` mantiene un pool abierto: un script de terminal que termina sin
 * `process.exit` se queda colgado esperando. Todos los de `scripts/` salen explicito.
 */
export const db = new Proxy({} as DB, {
  get(_, prop) {
    instancia ??= crear();
    const valor = Reflect.get(instancia, prop);
    return typeof valor === "function" ? valor.bind(instancia) : valor;
  },
});

export { schema };
export type { Db } from "./tipos";
