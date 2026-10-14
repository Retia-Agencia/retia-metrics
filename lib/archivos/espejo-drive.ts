import { Readable } from "node:stream";
import { google } from "googleapis";

import { clienteGoogle, SCOPES_RESPALDO } from "@/lib/sheets/auth";
import type { Espejo } from "./espejo";

const TIPO_CARPETA = "application/vnd.google-apps.folder";

function escaparConsulta(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function crearEspejoDrive(driveId: string): Espejo {
  const drive = google.drive({ version: "v3", auth: clienteGoogle(SCOPES_RESPALDO) });

  return {
    async asegurarCarpeta(nombre, padreId) {
      const respuesta = await drive.files.list({
        corpora: "drive",
        driveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        q: [
          `name = '${escaparConsulta(nombre)}'`,
          `'${escaparConsulta(padreId)}' in parents`,
          `mimeType = '${TIPO_CARPETA}'`,
          "trashed = false",
        ].join(" and "),
        fields: "files(id)",
        pageSize: 2,
      });
      const existente = respuesta.data.files?.[0]?.id;
      if (existente) return existente;

      const creada = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: nombre, mimeType: TIPO_CARPETA, parents: [padreId] },
        fields: "id",
      });
      if (!creada.data.id) throw new Error("Drive no devolvió el id de la carpeta creada.");
      return creada.data.id;
    },

    async subir({ nombre, padreId, tipoMime, bytes, archivoId }) {
      const subida = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: nombre, parents: [padreId], appProperties: { archivoId } },
        media: { mimeType: tipoMime, body: Readable.from(Buffer.from(bytes)) },
        fields: "id",
      });
      if (!subida.data.id) throw new Error("Drive no devolvió el id del archivo subido.");
      return subida.data.id;
    },

    async ubicacion(fileId) {
      try {
        const respuesta = await drive.files.get({
          fileId,
          supportsAllDrives: true,
          fields: "id,name,parents,trashed",
        });
        if (respuesta.data.trashed) return null;
        const nombre = respuesta.data.name;
        const padreId = respuesta.data.parents?.[0];
        return nombre && padreId ? { nombre, padreId } : null;
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number }; code?: number }).response?.status
          ?? (error as { code?: number }).code;
        if (status === 404) return null;
        throw error;
      }
    },

    async mover(fileId, { nombre, padreId }) {
      const actual = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: "parents",
      });
      const padres = actual.data.parents ?? [];
      const cambiaPadre = !padres.includes(padreId);
      await drive.files.update({
        fileId,
        supportsAllDrives: true,
        requestBody: { name: nombre },
        ...(cambiaPadre
          ? { addParents: padreId, removeParents: padres.join(",") || undefined }
          : {}),
      });
    },
  };
}
