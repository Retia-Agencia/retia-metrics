/**
 * Errores que la app sabe traducir a HTTP.
 *
 * Todo lo que NO extienda esta clase se considera un fallo no controlado: se
 * registra en el servidor y al cliente le llega "Error interno." y nada mas.
 * Decidir por tipo y no por forma es lo que evita que un error del driver de Neon
 * (que trae host y endpoint) o de googleapis (que trae el spreadsheetId) salga al
 * navegador solo por no tener la propiedad `status`.
 *
 * Vive fuera de lib/auth y de lib/sheets a proposito: las dos capas la necesitan y
 * ninguna debe depender de la otra.
 */
export class ErrorDeApp extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
  ) {
    super(mensaje);
    this.name = new.target.name;
  }
}
