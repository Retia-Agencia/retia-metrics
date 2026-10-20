import { z } from "zod";
import type { TipoIntegracion } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { organizacionDelToken, type FetchLike } from "@/lib/calendly/cita";
import { cuentasVisibles, usuarioDelToken } from "@/lib/pauta/meta-api";

type Fetch = typeof globalThis.fetch;
export type ConfigIntegracion = Record<string, string | boolean | null>;
type Definicion = {
  nombre: string;
  campo: string;
  llave: "llaveApi" | "token";
  esquema: z.ZodType<string>;
  probar: (valor: string, f: Fetch, config?: ConfigIntegracion) => Promise<ConfigIntegracion>;
};

const valorPegado = (nombre: string) => z.string().trim()
  .min(1, `${nombre} es obligatorio.`)
  .max(500, `${nombre} debe tener máximo 500 caracteres.`);

async function jsonSeguro(respuesta: Response, proveedor: string): Promise<Record<string, unknown>> {
  if (!respuesta.ok) throw new ErrorDeApp(`${proveedor} rechazó la conexión. Revisa el valor e inténtalo de nuevo.`, 422);
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new ErrorDeApp(`${proveedor} devolvió una respuesta inválida.`, 422);
  }
  return cuerpo as Record<string, unknown>;
}

async function probarDapta(valor: string, f: Fetch) {
  const cuerpo = await jsonSeguro(await f("https://forms-api.dapta.ai/v1/me", {
    headers: { Authorization: `Bearer ${valor}` },
  }), "Dapta");
  if (typeof cuerpo.accountId !== "string" || typeof cuerpo.accountName !== "string") {
    throw new ErrorDeApp("Dapta devolvió una respuesta inválida.", 422);
  }
  return { cuentaId: cuerpo.accountId, cuenta: cuerpo.accountName };
}

async function probarTypeform(valor: string, f: Fetch) {
  const cuerpo = await jsonSeguro(await f("https://api.typeform.com/me", {
    headers: { Authorization: `Bearer ${valor}` },
  }), "Typeform");
  if (typeof cuerpo.alias !== "string" || !cuerpo.alias.trim()) {
    throw new ErrorDeApp("Typeform devolvió una respuesta inválida.", 422);
  }
  return { alias: cuerpo.alias };
}

export const INTEGRACIONES = {
  dapta: {
    nombre: "Dapta", campo: "llave de la API", llave: "llaveApi",
    esquema: valorPegado("La llave de la API de Dapta"), probar: probarDapta,
  },
  typeform: {
    nombre: "Typeform", campo: "token", llave: "token",
    esquema: valorPegado("El token de Typeform"), probar: probarTypeform,
  },
  calendly: {
    nombre: "Calendly", campo: "token", llave: "token",
    esquema: valorPegado("El token de Calendly"),
    probar: async (valor, f) => ({ organizacion: await organizacionDelToken(f as unknown as FetchLike, valor) }),
  },
  meta: {
    nombre: "Meta", campo: "token", llave: "token",
    esquema: valorPegado("El token de Meta"),
    probar: async (valor, f) => {
      const [usuario] = await Promise.all([usuarioDelToken(valor, f), cuentasVisibles(valor, f)]);
      return { nombre: usuario.nombre };
    },
  },
  meta_capi: {
    nombre: "Meta CAPI", campo: "token", llave: "token",
    esquema: valorPegado("El token de Meta CAPI"),
    probar: async (valor, f, config) => {
      const datasetId = z.string().trim().regex(/^\d+$/, "El ID del dataset debe contener solo números.")
        .parse(config?.datasetId);
      const cuerpo = await jsonSeguro(await f(`https://graph.facebook.com/v26.0/${datasetId}?fields=id,name`, {
        headers: { Authorization: `Bearer ${valor}` },
      }), "Meta CAPI");
      if (typeof cuerpo.name !== "string" || !cuerpo.name.trim()) {
        throw new ErrorDeApp("Meta CAPI devolvió una respuesta inválida.", 422);
      }
      return { dataset: cuerpo.name };
    },
  },
} satisfies Record<TipoIntegracion, Definicion>;

export async function probarIntegracion(tipo: TipoIntegracion, valor: string, f: Fetch, config?: ConfigIntegracion) {
  try {
    return await INTEGRACIONES[tipo].probar(valor, f, config);
  } catch {
    throw new ErrorDeApp(`No se pudo probar ${INTEGRACIONES[tipo].nombre}. Revisa el ${INTEGRACIONES[tipo].campo} e inténtalo de nuevo.`, 422);
  }
}
