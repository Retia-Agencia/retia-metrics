type Memoria = Map<string, Promise<unknown>>;
type ModuloPorSolicitud = typeof import("@/lib/db/por-solicitud");

let memoriaActual: Memoria = new Map();

/**
 * Fábrica del `vi.mock("@/lib/db/por-solicitud", ...)` que cada test llama en su propio
 * archivo (vitest solo garantiza el izado ahí). Usa la fábrica real con la memoria activa
 * sobre la base de prueba: un `Map` por solicitud, que abre `abrirSolicitud()`.
 *
 * ponytail: este reemplazo solo cubre tests; si crons o MCP necesitan memoria fuera de React,
 * el camino de subida es AsyncLocalStorage dentro de por-solicitud.
 */
export async function moduloConMemoria(importActual: () => Promise<ModuloPorSolicitud>): Promise<ModuloPorSolicitud> {
  const real = await importActual();
  const memoria = real.crearUnaVezPorSolicitud({
    esLaBaseDeLaApp: () => true,
    esEscritura: async () => false,
    obtenerMemoria: () => memoriaActual,
  });
  return {
    ...real,
    unaVezPorSolicitud: memoria.unaVezPorSolicitud,
    olvidarDeLaSolicitud: memoria.olvidarDeLaSolicitud,
  };
}

/** Abre una solicitud nueva: lo memoizado antes deja de verse. */
export function abrirSolicitud(): void {
  memoriaActual = new Map();
}
