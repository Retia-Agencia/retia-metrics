import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

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

// DIAGNOSTICO TEMPORAL 436 (retirar): un id por carga del modulo revela copias del modulo en el bundle.
const DIAG_MODULO = Math.random().toString(36).slice(2, 6);
let diagSinAcumulador = 0;
console.log(JSON.stringify({ diag: "modulo", i: DIAG_MODULO }));

interface EstadoDeMedicionDeRender {
  costo: CostoDeSolicitud | null;
  finalizadorEntregado: boolean;
}

type ObtenerEstadoDeMedicion = () => EstadoDeMedicionDeRender;

const estadoDeMedicionDeRender = cache<ObtenerEstadoDeMedicion>(() => ({
  costo: null,
  finalizadorEntregado: false,
}));

export const SEGMENTOS_DE_RUTA = new Set([
  ".well-known",
  "admin",
  "ajustes",
  "alertas",
  "api",
  "archivos",
  "archivos-locales",
  "auth",
  "autorizar",
  "avisos",
  "bitacora",
  "calendly",
  "calls",
  "canales",
  "catalogos",
  "cierre",
  "clasificar",
  "comprobantes",
  "confirmar",
  "cron",
  "dashboard",
  "deals",
  "descargar.csv",
  "envios",
  "estudiantes-nuevos",
  "formularios",
  "grain",
  "grain.csv",
  "health",
  "hub",
  "inbox",
  "leads",
  "lista",
  "lista.csv",
  "login",
  "manual",
  "mcp",
  "meta-capi",
  "mcp-retencion",
  "me",
  "media",
  "metas",
  "mi-dia",
  "mi-espacio",
  "migracion",
  "nerd-stats",
  "oauth",
  "oauth-authorization-server",
  "oauth-protected-resource",
  "p",
  "pauta",
  "pauta-citas.csv",
  "pauta-semanal.csv",
  "pendientes",
  "perfil",
  "ping",
  "programa",
  "proxima-cohorte",
  "proyeccion-roas",
  "recursos",
  "reporte",
  "retencion",
  "revocar",
  "salud",
  "semaforo",
  "sin-ver",
  "students",
  "token",
  "usuarios",
  "webhooks",
]);

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

/**
 * Lee el estado compartido por React sin asumir que existe un render activo.
 * La dependencia inyectada mantiene este borde comprobable sin un renderer.
 */
export function costoDeRenderAbierto(
  obtenerEstado: ObtenerEstadoDeMedicion,
): CostoDeSolicitud | null {
  try {
    return obtenerEstado().costo;
  } catch {
    return null;
  }
}

/** Abre una sola medición sobre un estado cacheado por solicitud. */
export function abrirMedicionDeRender(
  ruta: string,
  obtenerEstado: ObtenerEstadoDeMedicion,
  emitir: (linea: string) => void,
): (() => void) | null {
  let estado: EstadoDeMedicionDeRender;
  try {
    estado = obtenerEstado();
  } catch {
    return null;
  }

  const eraNuevo = estado.costo === null;
  estado.costo ??= costoNuevo(patronDeRuta(ruta));
  // DIAGNOSTICO TEMPORAL 436 (retirar): ver si el acumulador es el mismo entre guardas y consultas.
  console.log(JSON.stringify({ diag: "abrir", i: DIAG_MODULO, nuevo: eraNuevo, entregado: estado.finalizadorEntregado }));
  if (estado.finalizadorEntregado) return null;
  estado.finalizadorEntregado = true;

  const costo = estado.costo;
  let emitido = false;
  return () => {
    console.log(JSON.stringify({ diag: "cierre", i: DIAG_MODULO, consultas: costo.consultas, sinAcumulador: diagSinAcumulador }));
    if (emitido || costo.consultas === 0) return;
    emitido = true;
    emitir(JSON.stringify({ costo: resumir(costo) }));
  };
}

function costoActivo(): CostoDeSolicitud | null {
  return contexto.getStore() ?? costoDeRenderAbierto(estadoDeMedicionDeRender);
}

/** Convierte un pathname real en la forma privada y estable que se escribe en logs. */
export function patronDeRuta(pathname: string): string {
  const [ruta] = pathname.split(/[?#]/, 1);
  const segmentos = ruta!.split("/");
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
      if (!segmento || SEGMENTOS_DE_RUTA.has(segmento)) return segmento;
      return "[id]";
    })
    .join("/");
}

/** Logger único de Drizzle. Fuera de una medición no hace nada. */
export const loggerDeCosto = {
  logQuery(sentencia: string, parametros: unknown[]): void {
    const costo = costoActivo();
    if (!costo) {
      diagSinAcumulador += 1;
      if (diagSinAcumulador === 1 || diagSinAcumulador % 50 === 0) {
        console.log(JSON.stringify({ diag: "consulta-sin-acumulador", i: DIAG_MODULO, total: diagSinAcumulador }));
      }
      return;
    }
    costo.consultas += 1;
    const parametrosSerializados = serializarParametros(parametros);
    if (parametrosSerializados !== "[no-serializable]") {
      const llave = `${sentencia}\u0000${parametrosSerializados}`;
      if (costo.vistas.has(llave)) costo.identicas += 1;
      else costo.vistas.add(llave);
    }
    costo.repetidas.set(sentencia, (costo.repetidas.get(sentencia) ?? 0) + 1);
  },
};

function serializarParametros(parametros: unknown[]): string {
  try {
    return JSON.stringify(parametros, function (clave, valor: unknown) {
      const original = clave ? (this as Record<string, unknown>)[clave] : valor;
      if (typeof original === "bigint") return original.toString();
      if (original instanceof Date) return original.toISOString();
      if (Buffer.isBuffer(original) || original instanceof Uint8Array) {
        return Buffer.from(original).toString("base64");
      }
      return valor;
    }) ?? "[no-serializable]";
  } catch {
    return "[no-serializable]";
  }
}

/** Lo llama el adaptador de `pg` al terminar cada consulta. */
export function registrarTiempoEnBase(ms: number): void {
  const costo = costoActivo();
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
  return abrirMedicionDeRender(ruta, estadoDeMedicionDeRender, console.log);
}
