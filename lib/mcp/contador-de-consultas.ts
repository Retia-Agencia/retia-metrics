import { AsyncLocalStorage } from "node:async_hooks";

interface EstadoDeConsultas {
  total: number;
}

const contexto = new AsyncLocalStorage<EstadoDeConsultas>();

/** Logger único de Drizzle: fuera de una llamada MCP no hace nada. */
export const loggerDeConsultasMcp = {
  logQuery(): void {
    const estado = contexto.getStore();
    if (estado) estado.total += 1;
  },
};

/** Aísla el contador por llamada, incluso cuando varias llamadas se ejecutan a la vez. */
export function conContadorDeConsultas<T>(
  ejecutar: (consultas: () => number) => Promise<T>,
): Promise<T> {
  const estado: EstadoDeConsultas = { total: 0 };
  return contexto.run(estado, () => ejecutar(() => estado.total));
}
