export interface Espejo {
  asegurarCarpeta(nombre: string, padreId: string): Promise<string>;
  subir(a: {
    nombre: string;
    padreId: string;
    tipoMime: string;
    bytes: Uint8Array;
    archivoId: string;
  }): Promise<string>;
  ubicacion(fileId: string): Promise<{ nombre: string; padreId: string } | null>;
  mover(fileId: string, a: { nombre: string; padreId: string }): Promise<void>;
}
