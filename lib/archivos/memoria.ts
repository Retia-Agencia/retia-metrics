import type { Almacen } from "./almacen";

export class AlmacenEnMemoria implements Almacen {
  private readonly objetos = new Map<string, Uint8Array>();

  async urlDeSubida(ruta: string, tipoMime: string) {
    return {
      url: `memoria://subida/${ruta}`,
      metodo: "PUT" as const,
      cabeceras: { "content-type": tipoMime },
    };
  }

  async escribir(ruta: string, bytes: Uint8Array): Promise<void> {
    this.objetos.set(ruta, bytes.slice());
  }

  async leer(ruta: string): Promise<Uint8Array | null> {
    return this.objetos.get(ruta)?.slice() ?? null;
  }

  async urlDeLectura(ruta: string, segundos: number): Promise<string> {
    return `memoria://lectura/${ruta}?segundos=${segundos}`;
  }

  async borrar(ruta: string): Promise<void> {
    this.objetos.delete(ruta);
  }
}
