import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { confirmarArchivo, pedirSubida, urlParaVer } from "@/lib/archivos";
import { AlmacenEnMemoria } from "@/lib/archivos/memoria";
import { MAX_BYTES } from "@/lib/archivos/reglas";
import { archivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let actorId: string;
let otroActorId: string;
let almacen: AlmacenEnMemoria;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "archivos",
    nombre: "Archivos",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const actores = await db.insert(users).values([
    { email: "actor@retia.co", rol: "closer" },
    { email: "otro@retia.co", rol: "closer" },
  ]).returning();
  actorId = actores[0].id;
  otroActorId = actores[1].id;
  almacen = new AlmacenEnMemoria();
});

afterEach(async () => cerrar());

async function nuevaSubida(tipoMime: "image/png" | "application/pdf" = "image/png", bytes = 8) {
  return pedirSubida(db, almacen, { programId, tipoMime, bytes, actorId });
}

async function fila(archivoId: string) {
  return (await db.select().from(archivos).where(eq(archivos.id, archivoId)))[0];
}

describe("archivos", () => {
  it.each([
    [{ tipoMime: "image/svg+xml", bytes: 10 }, 400],
    [{ tipoMime: "image/png", bytes: 0 }, 400],
    [{ tipoMime: "image/png", bytes: MAX_BYTES + 1 }, 400],
  ])("rechaza una solicitud inválida", async (cambio, status) => {
    await expect(pedirSubida(db, almacen, {
      programId,
      actorId,
      ...cambio,
    })).rejects.toMatchObject({ status });
  });

  it("pasa de pendiente a listo, calcula sha256 y genera una ruta opaca", async () => {
    const contenido = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);
    const { archivoId } = await nuevaSubida("image/png", 123);
    const pendiente = await fila(archivoId);
    expect(pendiente.estado).toBe("pendiente");
    expect(pendiente.ruta).not.toContain("@");
    expect(pendiente.ruta).toMatch(new RegExp(`^${programId}/\\d{4}-\\d{2}/${archivoId}\\.png$`));
    await almacen.escribir(pendiente.ruta, contenido);

    const listo = await confirmarArchivo(db, almacen, { archivoId, actorId });
    expect(listo).toMatchObject({ estado: "listo", bytes: contenido.byteLength });
    expect(listo.sha256).toBe(createHash("sha256").update(contenido).digest("hex"));
    expect(listo.confirmadoEn).toBeInstanceOf(Date);
    expect(await urlParaVer(db, almacen, archivoId)).toContain("segundos=60");
  });

  it("borra fila y objeto si el contenido contradice el tipo", async () => {
    const { archivoId } = await nuevaSubida();
    const pendiente = await fila(archivoId);
    await almacen.escribir(pendiente.ruta, new TextEncoder().encode("<html></html>"));
    await expect(confirmarArchivo(db, almacen, { archivoId, actorId })).rejects.toMatchObject({ status: 422 });
    expect(await fila(archivoId)).toBeUndefined();
    expect(await almacen.leer(pendiente.ruta)).toBeNull();
  });

  it("borra fila y objeto si el tamaño real supera 5 MB", async () => {
    const { archivoId } = await nuevaSubida();
    const pendiente = await fila(archivoId);
    const enorme = new Uint8Array(6 * 1024 * 1024);
    enorme.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await almacen.escribir(pendiente.ruta, enorme);
    await expect(confirmarArchivo(db, almacen, { archivoId, actorId })).rejects.toMatchObject({ status: 422 });
    expect(await fila(archivoId)).toBeUndefined();
    expect(await almacen.leer(pendiente.ruta)).toBeNull();
  });

  it("solo el autor confirma", async () => {
    const { archivoId } = await nuevaSubida();
    await expect(confirmarArchivo(db, almacen, { archivoId, actorId: otroActorId })).rejects.toMatchObject({ status: 403 });
  });

  it("confirmar dos veces es idempotente", async () => {
    const { archivoId } = await nuevaSubida();
    const pendiente = await fila(archivoId);
    await almacen.escribir(pendiente.ruta, Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const primera = await confirmarArchivo(db, almacen, { archivoId, actorId });
    await almacen.borrar(pendiente.ruta);
    expect(await confirmarArchivo(db, almacen, { archivoId, actorId })).toEqual(primera);
  });

  it("reporta cuando el objeto no se subió", async () => {
    const { archivoId } = await nuevaSubida();
    await expect(confirmarArchivo(db, almacen, { archivoId, actorId })).rejects.toMatchObject({ status: 409 });
  });

  it("no firma una lectura pendiente", async () => {
    const { archivoId } = await nuevaSubida();
    await expect(urlParaVer(db, almacen, archivoId)).rejects.toMatchObject({ status: 404 });
  });
});

const USA_STORAGE_REST = /\/storage\/v1/;

describe("el guardián del almacén muerde", () => {
  it.each([
    ["fetch('/storage/v1/object/x')", true],
    ["fetch('/api/archivos')", false],
  ])("%s → %s", (codigo, caza) => {
    expect(USA_STORAGE_REST.test(codigo)).toBe(caza);
  });

  it("solo lib/archivos conoce las rutas REST del almacén", () => {
    const culpables: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(nombre) && !ruta.replaceAll("\\", "/").includes("lib/archivos/")) {
          if (USA_STORAGE_REST.test(readFileSync(ruta, "utf8"))) culpables.push(ruta);
        }
      }
    };
    ["lib", "app", "components", "scripts"].forEach(recorrer);
    expect(culpables).toEqual([]);
  });
});
