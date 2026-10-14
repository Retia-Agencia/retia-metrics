import { BUCKET_ARCHIVOS, type Almacen } from "./almacen";

type RespuestaFirmada = { url?: string; signedURL?: string };

export function crearAlmacenSupabase(urlBase: string, clave: string): Almacen {
  const base = urlBase.replace(/\/$/, "");
  const cabecerasDeAuth = { apikey: clave, Authorization: `Bearer ${clave}` };

  async function exigirRespuesta(respuesta: Response): Promise<Response> {
    if (!respuesta.ok) throw new Error(`El almacén respondió con estado ${respuesta.status}.`);
    return respuesta;
  }

  return {
    async urlDeSubida(ruta, tipoMime) {
      const respuesta = await exigirRespuesta(await fetch(
        `${base}/storage/v1/object/upload/sign/${BUCKET_ARCHIVOS}/${ruta}`,
        { method: "POST", headers: cabecerasDeAuth },
      ));
      const datos = await respuesta.json() as RespuestaFirmada;
      if (!datos.url) throw new Error("El almacén no devolvió una URL de subida.");
      return {
        url: `${base}/storage/v1${datos.url}`,
        metodo: "PUT",
        cabeceras: { "content-type": tipoMime },
      };
    },

    async leer(ruta) {
      const respuesta = await fetch(
        `${base}/storage/v1/object/authenticated/${BUCKET_ARCHIVOS}/${ruta}`,
        { method: "GET", headers: cabecerasDeAuth },
      );
      if (respuesta.status === 400 || respuesta.status === 404) return null;
      await exigirRespuesta(respuesta);
      return new Uint8Array(await respuesta.arrayBuffer());
    },

    async urlDeLectura(ruta, segundos) {
      const respuesta = await exigirRespuesta(await fetch(
        `${base}/storage/v1/object/sign/${BUCKET_ARCHIVOS}/${ruta}`,
        {
          method: "POST",
          headers: { ...cabecerasDeAuth, "content-type": "application/json" },
          body: JSON.stringify({ expiresIn: segundos }),
        },
      ));
      const datos = await respuesta.json() as RespuestaFirmada;
      if (!datos.signedURL) throw new Error("El almacén no devolvió una URL de lectura.");
      return `${base}/storage/v1${datos.signedURL}`;
    },

    async borrar(ruta) {
      await exigirRespuesta(await fetch(`${base}/storage/v1/object/${BUCKET_ARCHIVOS}`, {
        method: "DELETE",
        headers: { ...cabecerasDeAuth, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: [ruta] }),
      }));
    },
  };
}
