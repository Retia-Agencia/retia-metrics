import { vi } from "vitest";

type Memoria = Map<string, Promise<unknown>>;

let memoriaActual: Memoria = new Map();

// ponytail: este reemplazo solo cubre tests; si crons o MCP necesitan memoria fuera de React,
// el camino de subida es AsyncLocalStorage dentro de por-solicitud.
vi.mock("@/lib/db/por-solicitud", async (importActual) => {
  const real = await importActual<typeof import("@/lib/db/por-solicitud")>();
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
});

export function abrirSolicitud(): void {
  memoriaActual = new Map();
}
