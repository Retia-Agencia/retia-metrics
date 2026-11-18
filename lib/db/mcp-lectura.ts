import { attachDatabasePool } from "@vercel/functions";
import { Pool, types } from "pg";
import type { PoolClient } from "pg";
import { CONEXION_TIMEOUT_MS } from "@/lib/tiempos";

/**
 * La conexión de LECTURA del MCP analítico (ADR 0135). Es un pool propio, con su propia cadena
 * (`DATABASE_URL_MCP_LECTURA`) y su propio usuario de base (`mcp_lectura_login`): el usuario de la sesión
 * de base no puede subir de privilegio con `SET ROLE`, que es lo que rompía el diseño de un rol compartido.
 *
 * Nunca cae a la conexión de la app: sin la variable, o con una cadena cuyo usuario no es `mcp_lectura_login`,
 * `consultar_datos` simplemente no se registra (`lib/mcp/herramientas/datos.ts`).
 */

export const USUARIO_DE_LECTURA = "mcp_lectura_login";
/** Conexiones de ESTE proceso para el MCP analítico. Se suman al tope de la app (AGENTS.md › Contratos, ticket 441). */
export const MAX_CONEXIONES_DE_LECTURA = 2;
export const TOPE_DE_LA_CONSULTA_MS = 5_000;

export interface CampoDeResultado {
  nombre: string;
  /** OID de Postgres del tipo de la columna. */
  tipo: number;
}

export interface ResultadoDeConsulta {
  filas: unknown[][];
  campos: CampoDeResultado[];
}

export type Consultar = (texto: string, valores?: unknown[]) => Promise<ResultadoDeConsulta>;

/** Una transacción que SIEMPRE termina en ROLLBACK: el alcance fijado dentro tampoco queda. */
export interface ConexionDeLectura {
  transaccion<T>(trabajo: (consultar: Consultar) => Promise<T>): Promise<T>;
}

const OID_DATE = 1082;
const OID_INT8 = 20;
const OID_NUMERIC = 1700;
const OID_TIMESTAMP = 1114;
const OID_TIMESTAMPTZ = 1184;

/** Fechas y marcas de tiempo como texto (nunca un Date en la zona de la máquina); conteos y sumas como número. */
const tipos = {
  getTypeParser: ((oid: number, formato?: "text" | "binary") => {
    if (oid === OID_DATE || oid === OID_TIMESTAMP || oid === OID_TIMESTAMPTZ) return (valor: string) => valor;
    if (oid === OID_INT8 || oid === OID_NUMERIC) return (valor: string) => Number(valor);
    return types.getTypeParser(oid, formato);
  }) as typeof types.getTypeParser,
};

/** El usuario de la cadena debe ser el de lectura: así una cadena equivocada (la de la app) nunca llega aquí. */
export function cadenaDeLecturaValida(cadena: string | undefined): cadena is string {
  if (!cadena) return false;
  try {
    return decodeURIComponent(new URL(cadena).username).split(".")[0] === USUARIO_DE_LECTURA;
  } catch {
    return false;
  }
}

function adaptar(cliente: PoolClient): Consultar {
  return async (texto, valores) => {
    const resultado = await cliente.query({ text: texto, values: valores, rowMode: "array", types: tipos });
    return {
      filas: resultado.rows as unknown[][],
      campos: resultado.fields.map((campo) => ({ nombre: campo.name, tipo: campo.dataTypeID })),
    };
  };
}

function conexionDeUnPool(pool: Pool): ConexionDeLectura {
  return {
    async transaccion(trabajo) {
      const cliente = await pool.connect();
      let rotura = false;
      try {
        await cliente.query("begin");
        return await trabajo(adaptar(cliente));
      } finally {
        try {
          await cliente.query("rollback");
        } catch {
          rotura = true;
        }
        cliente.release(rotura);
      }
    },
  };
}

const global = globalThis as unknown as { __retiaLectura?: ConexionDeLectura | null };

/** La conexión de lectura de este proceso, o `null` si no está configurada. Un pool por proceso. */
export function conexionMcpLectura(): ConexionDeLectura | null {
  if (global.__retiaLectura !== undefined) return global.__retiaLectura;
  const cadena = process.env.DATABASE_URL_MCP_LECTURA;
  if (!cadenaDeLecturaValida(cadena)) {
    if (cadena) console.error(`[mcp-lectura] DATABASE_URL_MCP_LECTURA no usa el usuario ${USUARIO_DE_LECTURA}; consultar_datos queda apagada.`);
    global.__retiaLectura = null;
    return null;
  }
  const pool = new Pool({
    connectionString: cadena,
    max: MAX_CONEXIONES_DE_LECTURA,
    idleTimeoutMillis: 5_000,
    statement_timeout: TOPE_DE_LA_CONSULTA_MS,
    query_timeout: TOPE_DE_LA_CONSULTA_MS + 2_000,
    connectionTimeoutMillis: CONEXION_TIMEOUT_MS,
  });
  pool.on("error", (error) => console.error("[mcp-lectura] conexion ociosa:", error.message));
  attachDatabasePool(pool);
  global.__retiaLectura = conexionDeUnPool(pool);
  return global.__retiaLectura;
}

/** Para los tests de Postgres real: el mismo adaptador sobre un pool que ellos crean. */
export const conexionDeUnPoolDePrueba = conexionDeUnPool;
