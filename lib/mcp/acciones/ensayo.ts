import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { MovimientoRechazado } from "@/lib/deals/mover-etapa";

class FinDeEnsayo<T> {
  constructor(readonly resultado: T) {}
}

export async function ensayar<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<{ ok: true; resultado: T } | { ok: false; razon: string }> {
  try {
    await (db as unknown as { transaction: <R>(f: (tx: Db) => Promise<R>) => Promise<R> }).transaction(async (tx) => {
      throw new FinDeEnsayo(await fn(tx));
    });
    throw new Error("El ensayo terminó sin forzar rollback.");
  } catch (error) {
    if (error instanceof FinDeEnsayo) return { ok: true, resultado: error.resultado as T };
    if (error instanceof ErrorDeApp || error instanceof MovimientoRechazado) return { ok: false, razon: error.message };
    throw error;
  }
}
