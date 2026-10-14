import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { archivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import type { Almacen } from "./almacen";
import { extensionDeTipo, MAX_BYTES, TIPOS_PERMITIDOS, tipoPorBytesMagicos } from "./reglas";
import { crearAlmacenSupabase } from "./supabase";

const entradaSubida = z.object({
  programId: z.string().uuid(),
  tipoMime: z.enum(TIPOS_PERMITIDOS, { error: "El tipo de archivo no está permitido." }),
  bytes: z.number().int().positive("El archivo debe tener contenido.").max(MAX_BYTES, "El archivo supera 5 MB."),
  actorId: z.string().uuid(),
});

export function almacenDeArchivos(): Almacen {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !clave) throw new ErrorDeApp("El almacén de archivos no está configurado.", 503);
  return crearAlmacenSupabase(url, clave);
}

export async function pedirSubida(
  db: Db,
  almacen: Almacen,
  entrada: { programId: string; tipoMime: string; bytes: number; actorId: string },
) {
  return normalizando(async () => {
    const datos = entradaSubida.parse(entrada);
    const archivoId = randomUUID();
    const mes = fechaDeInstanteEnBogota(new Date()).slice(0, 7);
    const ruta = `${datos.programId}/${mes}/${archivoId}.${extensionDeTipo(datos.tipoMime)}`;
    await db.insert(archivos).values({
      id: archivoId,
      programId: datos.programId,
      ruta,
      tipoMime: datos.tipoMime,
      bytes: datos.bytes,
      subidoPorUserId: datos.actorId,
    });
    return { archivoId, subida: await almacen.urlDeSubida(ruta, datos.tipoMime) };
  });
}

export async function confirmarArchivo(
  db: Db,
  almacen: Almacen,
  entrada: { archivoId: string; actorId: string },
) {
  const [archivo] = await db.select().from(archivos).where(eq(archivos.id, entrada.archivoId));
  if (!archivo) throw new ErrorDeApp("No existe el archivo.", 404);
  if (archivo.subidoPorUserId !== entrada.actorId) {
    throw new ErrorDeApp("No puedes confirmar un archivo subido por otra persona.", 403);
  }
  if (archivo.estado === "listo") return archivo;

  const contenido = await almacen.leer(archivo.ruta);
  if (!contenido) throw new ErrorDeApp("El archivo no se subió.", 409);

  const tipoReal = tipoPorBytesMagicos(contenido);
  if (contenido.byteLength > MAX_BYTES || tipoReal !== archivo.tipoMime) {
    await almacen.borrar(archivo.ruta);
    await db.delete(archivos).where(and(eq(archivos.id, archivo.id), eq(archivos.estado, "pendiente")));
    const mensaje = contenido.byteLength > MAX_BYTES
      ? "El archivo supera 5 MB."
      : "El contenido del archivo no coincide con su tipo declarado.";
    throw new ErrorDeApp(mensaje, 422);
  }

  const sha256 = createHash("sha256").update(contenido).digest("hex");
  const [confirmado] = await db.update(archivos).set({
    bytes: contenido.byteLength,
    sha256,
    estado: "listo",
    confirmadoEn: new Date(),
  }).where(eq(archivos.id, archivo.id)).returning();
  return confirmado;
}

/** La autorización de quien puede ver el comprobante corresponde al llamador (ticket 239). */
export async function urlParaVer(db: Db, almacen: Almacen, archivoId: string): Promise<string> {
  const [archivo] = await db.select().from(archivos).where(and(
    eq(archivos.id, archivoId),
    eq(archivos.estado, "listo"),
  ));
  if (!archivo) throw new ErrorDeApp("No existe el archivo.", 404);
  return almacen.urlDeLectura(archivo.ruta, 60);
}
