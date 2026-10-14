import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ErrorDeApp } from "@/lib/errors";
import type { Almacen } from "./almacen";

const DURACION_URL_SEGUNDOS = 5 * 60;
const RUTA_VALIDA = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/\d{4}-(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/i;

export function esRutaLocalValida(ruta: string): boolean {
  return !ruta.includes("..") && RUTA_VALIDA.test(ruta);
}

function exigirSecreto(secreto = process.env.AUTH_SECRET): string {
  if (!secreto) throw new ErrorDeApp("El almacén local no está configurado.", 503);
  return secreto;
}

export function firmaDeUrlLocal(metodo: "GET" | "PUT", ruta: string, exp: number, secreto: string): string {
  return createHmac("sha256", secreto).update(`${metodo}:${ruta}:${exp}`).digest("hex");
}

export function esFirmaLocalValida(
  metodo: "GET" | "PUT",
  ruta: string,
  exp: number,
  firma: string,
  opciones: { secreto?: string; ahora?: number } = {},
): boolean {
  if (!esRutaLocalValida(ruta) || !Number.isSafeInteger(exp) || exp <= (opciones.ahora ?? Date.now())) return false;
  const esperada = Buffer.from(firmaDeUrlLocal(metodo, ruta, exp, exigirSecreto(opciones.secreto)), "hex");
  const recibida = Buffer.from(firma, "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export function crearAlmacenEnDisco(opciones: {
  raiz?: string;
  secreto?: string;
  ahora?: () => number;
} = {}): Almacen {
  const raiz = opciones.raiz ?? join(/*turbopackIgnore: true*/ process.cwd(), ".archivos-locales");
  const secreto = exigirSecreto(opciones.secreto);
  const ahora = opciones.ahora ?? Date.now;

  const rutaAbsoluta = (ruta: string) => {
    if (!esRutaLocalValida(ruta)) throw new ErrorDeApp("La ruta del archivo no es válida.", 400);
    return join(/*turbopackIgnore: true*/ raiz, ...ruta.split("/"));
  };

  const urlFirmada = (metodo: "GET" | "PUT", ruta: string, segundos: number) => {
    const exp = ahora() + segundos * 1000;
    const firma = firmaDeUrlLocal(metodo, ruta, exp, secreto);
    return `/api/archivos-locales/${ruta}?exp=${exp}&firma=${firma}`;
  };

  return {
    async urlDeSubida(ruta, tipoMime) {
      return {
        url: urlFirmada("PUT", ruta, DURACION_URL_SEGUNDOS),
        metodo: "PUT",
        cabeceras: { "content-type": tipoMime },
      };
    },
    async leer(ruta) {
      try {
        return new Uint8Array(await readFile(rutaAbsoluta(ruta)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async urlDeLectura(ruta, segundos) {
      return urlFirmada("GET", ruta, segundos);
    },
    async borrar(ruta) {
      try {
        await unlink(rutaAbsoluta(ruta));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}

export async function escribirArchivoLocal(ruta: string, contenido: Uint8Array): Promise<void> {
  const destino = join(/*turbopackIgnore: true*/ process.cwd(), ".archivos-locales", ...ruta.split("/"));
  if (!esRutaLocalValida(ruta)) throw new ErrorDeApp("La ruta del archivo no es válida.", 400);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, contenido);
}

export async function leerArchivoLocal(ruta: string): Promise<Uint8Array | null> {
  return crearAlmacenEnDisco().leer(ruta);
}
