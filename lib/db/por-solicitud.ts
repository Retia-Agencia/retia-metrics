import { cache } from "react";
import { esEscrituraOFueraDeRequest } from "@/lib/auth/solicitud";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";

type MemoriaDeSolicitud = Map<string, Promise<unknown>>;

interface DependenciasPorSolicitud {
  obtenerMemoria: () => MemoriaDeSolicitud;
  esLaBaseDeLaApp: (db: Db) => boolean;
  esEscritura: () => Promise<boolean>;
}

function valorEstable(valor: unknown): string {
  if (valor instanceof Date) return `"${valor.toISOString()}"`;
  if (Array.isArray(valor)) return `[${valor.map(valorEstable).sort().join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, contenido]) => `${JSON.stringify(clave)}:${valorEstable(contenido)}`);
    return `{${entradas.join(",")}}`;
  }
  if (valor === undefined) return "undefined";
  return JSON.stringify(valor) ?? String(valor);
}

/** Arma una clave estable; objetos ordenan campos y arreglos de ids ordenan sus valores. */
export function claveDe(...partes: unknown[]): string {
  return partes.map((parte) => typeof parte === "string" ? parte : valorEstable(parte)).join(":");
}

/** Fabrica comprobable del alcance de lecturas de un render. */
export function crearUnaVezPorSolicitud(dependencias: DependenciasPorSolicitud) {
  async function unaVezPorSolicitud<T>(db: Db, clave: string, leer: () => Promise<T>): Promise<T> {
    if (!dependencias.esLaBaseDeLaApp(db)) return leer();

    try {
      if (await dependencias.esEscritura()) return leer();
    } catch {
      return leer();
    }

    let memoria: MemoriaDeSolicitud;
    try {
      memoria = dependencias.obtenerMemoria();
    } catch {
      return leer();
    }

    const anterior = memoria.get(clave) as Promise<T> | undefined;
    if (anterior) return anterior;

    const promesa: Promise<T> = leer().catch((error: unknown) => {
      if (memoria.get(clave) === promesa) memoria.delete(clave);
      throw error;
    });
    memoria.set(clave, promesa);
    return promesa;
  }

  function olvidarDeLaSolicitud(prefijo: string): void {
    let memoria: MemoriaDeSolicitud;
    try {
      memoria = dependencias.obtenerMemoria();
    } catch {
      return;
    }
    for (const clave of memoria.keys()) {
      if (clave.startsWith(prefijo)) memoria.delete(clave);
    }
  }

  return { unaVezPorSolicitud, olvidarDeLaSolicitud };
}

const obtenerMemoria = cache(() => new Map<string, Promise<unknown>>());
const porSolicitud = crearUnaVezPorSolicitud({
  obtenerMemoria,
  esLaBaseDeLaApp: (db) => db === dbDeLaApp,
  esEscritura: esEscrituraOFueraDeRequest,
});

export const unaVezPorSolicitud = porSolicitud.unaVezPorSolicitud;
export const olvidarDeLaSolicitud = porSolicitud.olvidarDeLaSolicitud;
