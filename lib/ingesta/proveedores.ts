import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProveedorFormulario } from "@/lib/catalogo/fuentes-webhook";
import type { EntradaEnvio } from "./envio";
import {
  entradaDesdeTypeform,
  payloadTypeformSchema,
  type MapeoWebhook,
} from "./adaptador-typeform";
import { entradaDesdeDapta, payloadDaptaSchema } from "./adaptador-dapta";

export interface OpcionesAdaptador {
  sourceId: string;
  zona: string;
  mapeo?: MapeoWebhook;
}

export interface ProveedorWebhook {
  headerFirma: string;
  /**
   * Si el payload trae el correo en una llave FIJA que el adaptador conoce, y por eso la
   * fuente puede no mapearlo (ticket 117). Typeform no: su correo es un titulo de pregunta.
   */
  correoPorDefecto: boolean;
  verificarFirma(cuerpoCrudo: string, header: string | null, secreto: string): boolean;
  adaptar(cuerpoCrudo: string, opciones: OpcionesAdaptador): EntradaEnvio;
}

const prefijoFirma = "sha256=";

function firmaTypeformValida(cuerpoCrudo: string, header: string | null, secreto: string): boolean {
  if (!header?.startsWith(prefijoFirma)) return false;
  const enviado = header.slice(prefijoFirma.length);
  const esperado = createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest();
  let recibido: Buffer;
  try {
    recibido = Buffer.from(enviado, "base64");
  } catch {
    return false;
  }
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

function firmaDaptaValida(cuerpoCrudo: string, header: string | null, secreto: string): boolean {
  if (!header?.startsWith(prefijoFirma)) return false;
  const enviado = header.slice(prefijoFirma.length);
  if (!/^[0-9a-f]{64}$/.test(enviado)) return false;
  const esperado = createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest();
  const recibido = Buffer.from(enviado, "hex");
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

export const PROVEEDORES: Record<ProveedorFormulario, ProveedorWebhook> = {
  typeform: {
    headerFirma: "typeform-signature",
    correoPorDefecto: false,
    verificarFirma: firmaTypeformValida,
    adaptar(cuerpoCrudo, opciones) {
      return entradaDesdeTypeform(payloadTypeformSchema.parse(JSON.parse(cuerpoCrudo)), opciones);
    },
  },
  dapta: {
    headerFirma: "x-forms-signature",
    correoPorDefecto: true,
    verificarFirma: firmaDaptaValida,
    adaptar(cuerpoCrudo, opciones) {
      return entradaDesdeDapta(payloadDaptaSchema.parse(JSON.parse(cuerpoCrudo)), opciones);
    },
  },
};

export function esProveedorRegistrado(valor: string | null): valor is ProveedorFormulario {
  return valor !== null && Object.prototype.hasOwnProperty.call(PROVEEDORES, valor);
}
