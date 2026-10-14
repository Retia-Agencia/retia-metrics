export const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type TipoPermitido = (typeof TIPOS_PERMITIDOS)[number];

export const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONES: Record<TipoPermitido, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionDeTipo(tipo: TipoPermitido): string {
  return EXTENSIONES[tipo];
}

function empiezaCon(bytes: Uint8Array, firma: readonly number[]): boolean {
  return firma.every((valor, indice) => bytes[indice] === valor);
}

export function tipoPorBytesMagicos(bytes: Uint8Array): TipoPermitido | null {
  if (empiezaCon(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    empiezaCon(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  if (empiezaCon(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}
