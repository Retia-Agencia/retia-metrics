import type { Espejo } from "./espejo";

type Carpeta = { id: string; nombre: string; padreId: string };
type Archivo = {
  id: string;
  archivoId: string;
  nombre: string;
  padreId: string;
  tipoMime: string;
  bytes: Uint8Array;
};

export class EspejoEnMemoria implements Espejo {
  private secuencia = 0;
  private readonly carpetas = new Map<string, Carpeta>();
  private readonly archivos = new Map<string, Archivo>();

  async asegurarCarpeta(nombre: string, padreId: string): Promise<string> {
    const existente = [...this.carpetas.values()].find(
      (carpeta) => carpeta.nombre === nombre && carpeta.padreId === padreId,
    );
    if (existente) return existente.id;

    const id = `carpeta-${++this.secuencia}`;
    this.carpetas.set(id, { id, nombre, padreId });
    return id;
  }

  async subir(a: {
    nombre: string;
    padreId: string;
    tipoMime: string;
    bytes: Uint8Array;
    archivoId: string;
  }): Promise<string> {
    const id = `archivo-${++this.secuencia}`;
    this.archivos.set(id, { id, ...a, bytes: a.bytes.slice() });
    return id;
  }

  async ubicacion(fileId: string): Promise<{ nombre: string; padreId: string } | null> {
    const archivo = this.archivos.get(fileId);
    return archivo ? { nombre: archivo.nombre, padreId: archivo.padreId } : null;
  }

  async mover(fileId: string, a: { nombre: string; padreId: string }): Promise<void> {
    const archivo = this.archivos.get(fileId);
    if (!archivo) throw new Error("El archivo no existe en el espejo.");
    archivo.nombre = a.nombre;
    archivo.padreId = a.padreId;
  }

  borrar(fileId: string): void {
    this.archivos.delete(fileId);
  }

  archivoDe(archivoId: string): (Archivo & { ruta: string[] }) | null {
    const archivo = [...this.archivos.values()].find((fila) => fila.archivoId === archivoId);
    if (!archivo) return null;
    return { ...archivo, bytes: archivo.bytes.slice(), ruta: this.rutaDe(archivo.padreId) };
  }

  private rutaDe(carpetaId: string): string[] {
    const ruta: string[] = [];
    let actual = this.carpetas.get(carpetaId);
    while (actual) {
      ruta.unshift(actual.nombre);
      actual = this.carpetas.get(actual.padreId);
    }
    return ruta;
  }
}
