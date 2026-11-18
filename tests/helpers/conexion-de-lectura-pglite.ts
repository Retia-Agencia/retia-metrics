import type { PGlite } from "@electric-sql/pglite";
import type { ConexionDeLectura, Consultar } from "@/lib/db/mcp-lectura";
import type { Db } from "@/lib/db/tipos";

/**
 * La conexión de lectura sobre PGlite. PGlite corre como superusuario y no tiene un login aparte, así que baja de
 * privilegios con `SET LOCAL ROLE mcp_lectura_login`: sirve para probar vistas, alcance, topes y paridad, NO el cierre
 * del escape por `SET ROLE`, que solo se prueba contra Postgres real (`tests/mcp-lectura-postgres.test.ts`).
 */
export function conexionDeLecturaPglite(db: Db): ConexionDeLectura {
  const cliente = (db as Db & { $client: PGlite }).$client;
  const parsers = { 1082: (v: string) => v, 1114: (v: string) => v, 1184: (v: string) => v, 20: (v: string) => Number(v), 1700: (v: string) => Number(v) };
  return {
    async transaccion(trabajo) {
      await cliente.exec("begin; set local role mcp_lectura_login");
      const consultar: Consultar = async (texto, valores) => {
        const r = await cliente.query(texto, valores, { rowMode: "array", parsers });
        return { filas: r.rows as unknown[][], campos: r.fields.map((f) => ({ nombre: f.name, tipo: f.dataTypeID })) };
      };
      try {
        return await trabajo(consultar);
      } finally {
        await cliente.exec("rollback");
      }
    },
  };
}
