export const BUCKET_ARCHIVOS = "comprobantes";

export interface Almacen {
  urlDeSubida(
    ruta: string,
    tipoMime: string,
  ): Promise<{ url: string; metodo: "PUT"; cabeceras: Record<string, string> }>;
  leer(ruta: string): Promise<Uint8Array | null>;
  urlDeLectura(ruta: string, segundos: number): Promise<string>;
  borrar(ruta: string): Promise<void>;
}
