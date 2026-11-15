import { AsyncLocalStorage } from "node:async_hooks";

export interface CostoDeSolicitud {
  ruta: string;
  consultas: number;
  identicas: number;
  repetidas: Map<string, number>;
  vistas: Set<string>;
  inicio: number;
  msEnBase: number;
}

export interface ResumenDeCosto {
  ruta: string;
  consultas: number;
  identicas: number;
  nMasUno: number;
  msEnBase: number;
  ms: number;
}

const contexto = new AsyncLocalStorage<CostoDeSolicitud>();

function costoNuevo(ruta: string): CostoDeSolicitud {
  return {
    ruta,
    consultas: 0,
    identicas: 0,
    repetidas: new Map(),
    vistas: new Set(),
    inicio: performance.now(),
    msEnBase: 0,
  };
}

/** Convierte un pathname real en la forma privada y estable que se escribe en logs. */
export function patronDeRuta(pathname: string): string {
  const segmentos = pathname.split("/");
  let despuesDePrograma = false;

  return segmentos
    .map((segmento) => {
      if (despuesDePrograma) {
        despuesDePrograma = false;
        return segmento ? "[programa]" : segmento;
      }
      if (segmento === "p") {
        despuesDePrograma = true;
        return segmento;
      }
      const esIdNumerico = /^\d+$/.test(segmento);
      const esUuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(segmento);
      const esIdOpaco = segmento.length >= 12
        && /\d/.test(segmento)
        && /^[A-Za-z0-9_-]+$/.test(segmento);
      return esIdNumerico || esUuid || esIdOpaco ? "[id]" : segmento;
    })
    .join("/");
}

/** Logger único de Drizzle. Fuera de una medición no hace nada. */
export const loggerDeCosto = {
  logQuery(sentencia: string, parametros: unknown[]): void {
    const costo = contexto.getStore();
    if (!costo) return;
    costo.consultas += 1;
    const llave = `${sentencia}\u0000${JSON.stringify(parametros)}`;
    if (costo.vistas.has(llave)) costo.identicas += 1;
    else costo.vistas.add(llave);
    costo.repetidas.set(sentencia, (costo.repetidas.get(sentencia) ?? 0) + 1);
  },
};

/** Lo llama el adaptador de `pg` al terminar cada consulta. */
export function registrarTiempoEnBase(ms: number): void {
  const costo = contexto.getStore();
  if (costo) costo.msEnBase += ms;
}

function resumir(costo: CostoDeSolicitud): ResumenDeCosto {
  const repeticiones = [...costo.repetidas.values()]
    .reduce((total, veces) => total + Math.max(0, veces - 1), 0);
  return {
    ruta: costo.ruta,
    consultas: costo.consultas,
    identicas: costo.identicas,
    nMasUno: Math.max(0, repeticiones - costo.identicas),
    msEnBase: Math.round(costo.msEnBase),
    ms: Math.round(performance.now() - costo.inicio),
  };
}

/** Medición explícita para tests, scripts y el MCP. No escribe en el log. */
export function medir<T>(
  ruta: string,
  ejecutar: () => Promise<T>,
): Promise<{ valor: T; costo: ResumenDeCosto }> {
  const costo = costoNuevo(patronDeRuta(ruta));
  return contexto.run(costo, async () => ({ valor: await ejecutar(), costo: resumir(costo) }));
}

/** Conserva el contrato del MCP mientras mueve el concepto a su módulo único. */
export function conContadorDeConsultas<T>(
  ejecutar: (consultas: () => number) => Promise<T>,
): Promise<T> {
  const costo = costoNuevo("mcp");
  return contexto.run(costo, () => ejecutar(() => costo.consultas));
}

/**
 * Abre una medición para el render actual. La primera guarda gana: layout y página
 * comparten el mismo contexto y programan una sola línea de cierre.
 */
export function iniciarMedicionDeSolicitud(ruta: string): (() => void) | null {
  if (contexto.getStore()) return null;
  const costo = costoNuevo(patronDeRuta(ruta));
  contexto.enterWith(costo);
  let emitido = false;
  return () => {
    if (emitido || costo.consultas === 0) return;
    emitido = true;
    console.log(JSON.stringify({ costo: resumir(costo) }));
  };
}
