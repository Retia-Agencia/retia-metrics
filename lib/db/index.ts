import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { PoolClient } from "pg";
import * as schema from "./schema";
import { loggerDeCosto, medirTiempoEnBase } from "./medidor";
import {
  CONEXION_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
} from "@/lib/tiempos";

type DB = ReturnType<typeof crear>;

/** Tope de conexiones de ESTE proceso. La cuenta completa vive en AGENTS.md › Contratos (ticket 441). */
const MAX_CONEXIONES_POR_PROCESO = 5;

export function opcionesDePool(connectionString: string) {
  return {
    connectionString,
    max: MAX_CONEXIONES_POR_PROCESO,
    idleTimeoutMillis: 5_000,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    connectionTimeoutMillis: CONEXION_TIMEOUT_MS,
  };
}

// Un pool por PROCESO, no por copia del modulo: Next instancia `lib/db` mas de una vez (paginas y route
// handlers) y `next dev` lo recarga en cada cambio. Medido el 14-nov: 15 conexiones en un proceso de
// produccion y "too many clients" en dev. `globalThis` es lo unico que comparten todas las copias.
const global = globalThis as unknown as { __retiaDb?: DB };

const CONSULTAS_MEDIDAS = Symbol("consultas-medidas");
const TOPE_EN_TRANSACCIONES = Symbol("tope-en-transacciones");

type Consultable = Pick<PoolClient, "query"> & { [CONSULTAS_MEDIDAS]?: true };
type ClienteConTope = Pick<PoolClient, "query"> & { [TOPE_EN_TRANSACCIONES]?: true };

/** Conserva las variantes Promise y callback de `pg` y evita envolver dos veces un cliente. */
export function envolverConsultasMedidas(consultable: Consultable): void {
  if (consultable[CONSULTAS_MEDIDAS]) return;
  const consultar = consultable.query.bind(consultable);
  consultable.query = ((...argumentos: unknown[]) => {
    const terminar = medirTiempoEnBase();
    const ultimo = argumentos.at(-1);
    if (typeof ultimo === "function") {
      argumentos[argumentos.length - 1] = (...respuesta: unknown[]) => {
        terminar();
        return Reflect.apply(ultimo, undefined, respuesta);
      };
      return Reflect.apply(consultar, consultable, argumentos);
    }
    try {
      const resultado = Reflect.apply(consultar, consultable, argumentos);
      return Promise.resolve(resultado).finally(() => {
        terminar();
      });
    } catch (error) {
      terminar();
      throw error;
    }
  }) as PoolClient["query"];
  consultable[CONSULTAS_MEDIDAS] = true;
}

function textoDeConsulta(consulta: unknown): unknown {
  if (typeof consulta === "string") return consulta;
  if (typeof consulta === "object" && consulta !== null && "text" in consulta) {
    return consulta.text;
  }
  return undefined;
}

/** Aplica el tope del servidor dentro de cada transaccion abierta por Drizzle. */
export function aplicarTopeEnTransacciones(cliente: ClienteConTope): void {
  if (cliente[TOPE_EN_TRANSACCIONES]) return;
  const consultar = cliente.query.bind(cliente);
  cliente.query = ((...argumentos: unknown[]) => {
    if (textoDeConsulta(argumentos[0]) !== "begin") {
      return Reflect.apply(consultar, cliente, argumentos);
    }

    const aplicarTope = () =>
      Reflect.apply(consultar, cliente, [
        `set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`,
      ]);
    const ultimo = argumentos.at(-1);
    if (typeof ultimo === "function") {
      argumentos[argumentos.length - 1] = (error: unknown, resultado: unknown) => {
        if (error) return Reflect.apply(ultimo, undefined, [error, resultado]);
        return Promise.resolve(aplicarTope()).then(
          () => Reflect.apply(ultimo, undefined, [null, resultado]),
          (errorDelTope) => Reflect.apply(ultimo, undefined, [errorDelTope]),
        );
      };
      return Reflect.apply(consultar, cliente, argumentos);
    }

    return Promise.resolve(Reflect.apply(consultar, cliente, argumentos)).then(
      async (resultado) => {
        await aplicarTope();
        return resultado;
      },
    );
  }) as PoolClient["query"];
  cliente[TOPE_EN_TRANSACCIONES] = true;
}

function crear() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y pon la connection string del " +
        "pooler de Supabase (puerto 6543).",
    );
  }
  const pool = new Pool(opcionesDePool(connectionString));
  // Un error en una conexion ociosa no puede tumbar el proceso.
  pool.on("error", (error) => console.error("[db] conexion ociosa:", error.message));
  // Solo los clientes: `pool.query` consulta por dentro con uno de ellos, y envolver tambien el pool contaria dos veces.
  pool.on("connect", envolverConsultasMedidas);
  pool.on("connect", aplicarTopeEnTransacciones);
  attachDatabasePool(pool);
  return drizzle(pool, { schema, logger: loggerDeCosto });
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
 * ⚠️ `pg` mantiene el pool abierto: un script de terminal que termina sin
 * `process.exit` se queda esperando. Todos los de `scripts/` salen explicito.
 */
export const db = new Proxy({} as DB, {
  get(_, prop) {
    global.__retiaDb ??= crear();
    const valor = Reflect.get(global.__retiaDb, prop);
    return typeof valor === "function" ? valor.bind(global.__retiaDb) : valor;
  },
});

export { schema };
export type { Db } from "./tipos";
