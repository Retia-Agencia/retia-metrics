import { MAX_BYTES, TIPOS_PERMITIDOS, type TipoPermitido } from "./reglas";

const LADO_MAXIMO = 2000;
const CALIDAD_JPEG = 0.85;

function tipoPermitido(tipo: string): tipo is TipoPermitido {
  return (TIPOS_PERMITIDOS as readonly string[]).includes(tipo);
}

function canvasAArchivo(canvas: HTMLCanvasElement, nombre: string): Promise<File> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob) return reject(new Error("No se pudo comprimir la imagen."));
    resolve(new File([blob], nombre.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
  }, "image/jpeg", CALIDAD_JPEG));
}

/** Prepara un comprobante en el navegador; no conoce la base ni el almacén. */
export async function comprimirComprobante(archivo: File): Promise<File> {
  if (!tipoPermitido(archivo.type)) throw new Error("Solo puedes subir imágenes o archivos PDF.");

  let preparado = archivo;
  if (archivo.type !== "application/pdf") {
    const imagen = await createImageBitmap(archivo);
    try {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(imagen.width * escala));
      canvas.height = Math.max(1, Math.round(imagen.height * escala));
      const contexto = canvas.getContext("2d");
      if (!contexto) throw new Error("No se pudo preparar la imagen.");
      contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      preparado = await canvasAArchivo(canvas, archivo.name);
    } finally {
      imagen.close();
    }
  }

  if (preparado.size > MAX_BYTES) throw new Error("El archivo supera 5 MB después de prepararlo.");
  return preparado;
}
