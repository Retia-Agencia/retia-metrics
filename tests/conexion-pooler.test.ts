import { describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env.DATABASE_URL_PRUEBA_POSTGRES;
const conPostgres = url ? describe : describe.skip;

const LIMITE_RONDA_MS = 15_000;

async function conLimite<T>(promesa: Promise<T>, ronda: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`La ronda ${ronda} supero ${LIMITE_RONDA_MS / 1_000} s`)),
      LIMITE_RONDA_MS,
    );
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

conPostgres("conexion al pooler con node-postgres", () => {
  it("no cruza parametros ni cuelga consultas y transacciones concurrentes", async () => {
    const pool = new Pool({ connectionString: url!, max: 5, connectionTimeoutMillis: 10_000 });
    try {
      for (let ronda = 1; ronda <= 20; ronda++) {
        const transacciones = Array.from({ length: 10 }, async (_, indice) => {
          const esperado = ronda * 10_000 + indice;
          const cliente = await pool.connect();
          try {
            await cliente.query("begin");
            const { rows } = await cliente.query<{ valor: number }>("select $1::int as valor", [esperado]);
            expect(rows[0]?.valor).toBe(esperado);
            await cliente.query("commit");
          } catch (error) {
            await cliente.query("rollback").catch(() => undefined);
            throw error;
          } finally {
            cliente.release();
          }
        });
        const consultas = Array.from({ length: 50 }, async (_, indice) => {
          const esperado = ronda * 100_000 + indice;
          const { rows } = await pool.query<{ valor: number }>("select $1::int as valor", [esperado]);
          expect(rows[0]?.valor).toBe(esperado);
        });

        await conLimite(Promise.all([...transacciones, ...consultas]), ronda);
      }
    } catch (error) {
      console.error("[conexion-pooler] error completo:", error);
      throw error;
    } finally {
      await pool.end();
    }
  }, 330_000);
});
