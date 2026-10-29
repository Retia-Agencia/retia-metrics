/**
 * Por que una lectura de Grain falla (ADR 0112, ticket 328). Son codigos y no texto libre:
 * se guardan en `transcripcionesLlamada.error`, la alarma los cuenta y la cron decide con ellos.
 * Grain no tiene API documentada, asi que `formato_cambio` es el que avisa que su pagina
 * cambio y hay que tocar el parser.
 */
export const CODIGOS_DE_ERROR_GRAIN = [
  "link_invalido", // no es un link de nota de Grain (host o ruta)
  "no_encontrado", // 404: la grabacion se borro o el link esta mal copiado
  "bloqueado", // la grabacion es privada o pide sesion
  "no_procesado", // Grain todavia procesa la llamada; se reintenta
  "sin_transcript", // la pagina cargo pero no trae palabras
  "formato_cambio", // la pagina cambio: falta el JSON o no tiene la forma esperada
  "red", // timeout, 5xx o fallo de conexion; se reintenta
] as const;

export type CodigoDeErrorGrain = (typeof CODIGOS_DE_ERROR_GRAIN)[number];

/** Los que no se arreglan reintentando: el cron los salta hasta que cambie el link. */
export const ERRORES_DEFINITIVOS: readonly CodigoDeErrorGrain[] = ["link_invalido", "no_encontrado", "bloqueado"];

export class ErrorDeGrain extends Error {
  constructor(
    readonly codigo: CodigoDeErrorGrain,
    detalle?: string,
  ) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.name = "ErrorDeGrain";
  }
}

export function esCodigoDeErrorGrain(valor: string | null): valor is CodigoDeErrorGrain {
  return valor !== null && (CODIGOS_DE_ERROR_GRAIN as readonly string[]).includes(valor);
}
