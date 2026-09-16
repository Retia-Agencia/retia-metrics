import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DB = ReturnType<typeof crear>;

let instancia: DB | null = null;

function crear() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y pon la connection string de Neon.",
    );
  }
  return drizzle(neon(connectionString), { schema });
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
