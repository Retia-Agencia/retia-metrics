import { z } from "zod";
import type { TipoIntegracion } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { ErrorDeCalendly, organizacionDelToken, type FetchLike } from "@/lib/calendly/cita";
import { LARGO_MAXIMO_SECRETO } from "./limites";
import { cuentasVisibles, usuarioDelToken } from "@/lib/pauta/meta-api";

type Fetch = typeof globalThis.fetch;
export type ConfigIntegracion = Record<string, string | boolean | null>;
type Definicion = {
  nombre: string;
  campo: string;
  llave: "llaveApi" | "token" | "hottok";
  esquema: z.ZodType<string>;
  probar: (valor: string, f: Fetch, config?: ConfigIntegracion) => Promise<ConfigIntegracion>;
};

const valorPegado = (nombre: string) => z.string().trim()
  .min(1, `${nombre} es obligatorio.`)
  .max(LARGO_MAXIMO_SECRETO, `${nombre} debe tener máximo ${LARGO_MAXIMO_SECRETO} caracteres.`);

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
      // El nombre es solo para mostrar. Un token de Events Manager sirve para ENVIAR eventos pero no
      // para leer el dataset (medido el 14-nov con el de Líder Arte: scope `read_ads_dataset_quality`,
      // "(#100) Missing Permission"), así que una respuesta no-ok no rechaza el token: la validación
      // de verdad es el evento de prueba, que configurarMetaCapi exige antes de encender.
      const respuesta = await f(`https://graph.facebook.com/v26.0/${datasetId}?fields=id,name`, {
        headers: { Authorization: `Bearer ${valor}` },
      });
      const cuerpo: unknown = respuesta.ok ? await respuesta.json().catch(() => null) : null;
      const nombre = typeof cuerpo === "object" && cuerpo !== null
        ? (cuerpo as Record<string, unknown>).name
        : null;
      return { dataset: typeof nombre === "string" && nombre.trim() ? nombre : "Dataset" };
    },
  },
  hotmart: {
    nombre: "Hotmart", campo: "hottok", llave: "hottok",
    esquema: valorPegado("El hottok de Hotmart"),
    // Hotmart no ofrece una API para probar el hottok: la prueba real es el primer evento.
    probar: async () => ({}),
  },
} satisfies Record<TipoIntegracion, Definicion>;

export async function probarIntegracion(tipo: TipoIntegracion, valor: string, f: Fetch, config?: ConfigIntegracion) {
  try {
    return await INTEGRACIONES[tipo].probar(valor, f, config);
  } catch (error) {
    // El motivo que da el proveedor (token rechazado, 429, 5xx) es lo que permite actuar; sin él el
    // gerente no distingue un token malo de una caída. Solo pasan mensajes escritos por nosotros.
    const causa = error instanceof ErrorDeCalendly || error instanceof ErrorDeApp ? ` ${error.message}` : "";
    throw new ErrorDeApp(`No se pudo probar ${INTEGRACIONES[tipo].nombre}.${causa} Revisa el ${INTEGRACIONES[tipo].campo} e inténtalo de nuevo.`, 422);
  }
}
