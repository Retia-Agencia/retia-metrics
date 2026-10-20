import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { changeLog, integraciones, programs, type TipoIntegracion } from "@/lib/db/schema";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { INTEGRACIONES, probarIntegracion, type ConfigIntegracion } from "./registro";
import { registrarCambioDeSecreto } from "./rastro";

type Secretos = { token?: string; llaveApi?: string; claveFirma?: string };
export type TokensMeta = ReadonlyMap<string, string>;

async function programa(db: Db, programId: string) {
  const [fila] = await db.select({ id: programs.id, nombre: programs.nombre }).from(programs).where(eq(programs.id, programId));
  if (!fila) throw new ErrorDeApp("No existe un programa con ese id.", 404);
  return fila;
}

/** Único escritor de integraciones.secretos. */
async function escribir(
  db: Db,
  input: { actorId: string; programId: string; tipo: TipoIntegracion; secretos: Secretos; config?: ConfigIntegracion; probadaEn?: Date | null; campo: string },
) {
  const [actual] = await db.select({
    id: integraciones.id, secretos: integraciones.secretos,
    config: integraciones.config, probadaEn: integraciones.probadaEn,
  })
    .from(integraciones).where(and(eq(integraciones.programId, input.programId), eq(integraciones.tipo, input.tipo)));
  const p = await programa(db, input.programId);
  const id = actual?.id ?? crypto.randomUUID();
  const secretos = { ...((actual?.secretos ?? {}) as Secretos), ...input.secretos };
  const config = { ...((actual?.config ?? {}) as ConfigIntegracion), ...(input.config ?? {}) };
  const [guardada] = await db.insert(integraciones).values({
    id, programId: input.programId, tipo: input.tipo, secretos,
    config, probadaEn: input.probadaEn ?? actual?.probadaEn ?? null,
    actualizadaPorUserId: input.actorId, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [integraciones.programId, integraciones.tipo],
    set: {
      secretos, config,
      probadaEn: input.probadaEn === undefined ? actual?.probadaEn ?? null : input.probadaEn,
      actualizadaPorUserId: input.actorId, updatedAt: new Date(),
    },
  }).returning();
  await registrarCambioDeSecreto(db, {
    tabla: "integraciones", registroId: guardada.id,
    etiqueta: `${p.nombre} · ${INTEGRACIONES[input.tipo].nombre}`,
    campo: `secretos.${input.campo}`, teniaValor: Boolean((actual?.secretos as Secretos | undefined)?.[input.campo as keyof Secretos]),
    actorId: input.actorId,
  });
}

export async function guardarIntegracion(
  db: Db, actorId: string, programId: string, tipo: TipoIntegracion, valorCrudo: string,
  f: typeof globalThis.fetch = globalThis.fetch,
  configInicial?: ConfigIntegracion,
): Promise<ConfigIntegracion> {
  return normalizando(async () => {
    const definicion = INTEGRACIONES[tipo];
    const valor = definicion.esquema.parse(valorCrudo);
    const probada = await probarIntegracion(tipo, valor, f, configInicial);
    const config = { ...(configInicial ?? {}), ...probada };
    await db.transaction(async (tx) => escribir(tx as Db, {
      actorId, programId, tipo, secretos: { [definicion.llave]: valor }, config,
      probadaEn: new Date(), campo: definicion.llave,
    }));
    return config;
  });
}

export async function guardarClaveFirmaCalendly(
  db: Db, actorId: string, programId: string, clave: string,
): Promise<void> {
  await db.transaction(async (tx) => escribir(tx as Db, {
    actorId, programId, tipo: "calendly", secretos: { claveFirma: clave }, campo: "claveFirma",
  }));
}

export async function probarIntegracionGuardada(
  db: Db, actorId: string, programId: string, tipo: TipoIntegracion,
  f: typeof globalThis.fetch = globalThis.fetch,
): Promise<ConfigIntegracion> {
  const definicion = INTEGRACIONES[tipo];
  const valor = await secreto(db, programId, tipo, definicion.llave);
  if (!valor) throw new ErrorDeApp(`Primero conecta ${definicion.nombre} en Integraciones.`, 422);
  const [filaActual] = await db.select({ config: integraciones.config }).from(integraciones)
    .where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, tipo)));
  const actual = (filaActual?.config ?? {}) as ConfigIntegracion;
  let config: ConfigIntegracion;
  try {
    config = { ...actual, ...await probarIntegracion(tipo, valor, f, actual) };
  } catch (error) {
    await db.update(integraciones).set({ probadaEn: null })
      .where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, tipo)));
    throw error;
  }
  await db.update(integraciones).set({
    probadaEn: new Date(), config, updatedAt: new Date(), actualizadaPorUserId: actorId,
  }).where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, tipo)));
  return config;
}

async function secreto(db: Db, programId: string, tipo: TipoIntegracion, llave: keyof Secretos): Promise<string | null> {
  const [fila] = await db.select({ secretos: integraciones.secretos }).from(integraciones)
    .where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, tipo)));
  const valor = (fila?.secretos as Secretos | undefined)?.[llave];
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

export const tokenCalendly = (db: Db, programId: string) => secreto(db, programId, "calendly", "token");
export const claveFirmaCalendly = (db: Db, programId: string) => secreto(db, programId, "calendly", "claveFirma");
export const tokenTypeform = (db: Db, programId: string) => secreto(db, programId, "typeform", "token");

export async function tokensCalendly(db: Db, programIds: readonly string[]): Promise<Map<string, string>> {
  if (programIds.length === 0) return new Map();
  const filas = await db.select({ programId: integraciones.programId, secretos: integraciones.secretos }).from(integraciones)
    .where(and(eq(integraciones.tipo, "calendly"), inArray(integraciones.programId, [...programIds])));
  return new Map(filas.flatMap((fila) => {
    const token = (fila.secretos as Secretos).token;
    return token ? [[fila.programId, token] as const] : [];
  }));
}

export async function tokensMeta(db: Db): Promise<TokensMeta> {
  const filas = await db.select({ programId: integraciones.programId, secretos: integraciones.secretos }).from(integraciones)
    .where(eq(integraciones.tipo, "meta"));
  return new Map(filas.flatMap((fila) => {
    const token = (fila.secretos as Secretos).token;
    return token ? [[fila.programId, token] as const] : [];
  }));
}

export async function tokenMeta(db: Db, programId: string): Promise<string> {
  const token = await secreto(db, programId, "meta", "token");
  if (!token) throw new ErrorDeApp("Primero conecta Meta en Integraciones.", 422);
  return token;
}

export async function credencialesMetaCapi(
  db: Db, programId: string,
): Promise<{ token: string; datasetId: string; encendido: boolean } | null> {
  const [fila] = await db.select({ secretos: integraciones.secretos, config: integraciones.config })
    .from(integraciones)
    .where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, "meta_capi")));
  const token = (fila?.secretos as Secretos | undefined)?.token;
  const config = (fila?.config ?? {}) as ConfigIntegracion;
  if (!token || typeof config.datasetId !== "string") return null;
  return { token, datasetId: config.datasetId, encendido: config.encendido === true };
}

export async function configurarMetaCapi(
  db: Db, actorId: string, programId: string, input: { datasetId: string; encendido: boolean },
): Promise<void> {
  const datasetId = input.datasetId.trim();
  if (!/^\d+$/.test(datasetId)) throw new ErrorDeApp("El ID del dataset debe contener solo números.", 422);
  const [fila] = await db.select({ id: integraciones.id, config: integraciones.config }).from(integraciones)
    .where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, "meta_capi")));
  if (!fila) throw new ErrorDeApp("Primero conecta Meta CAPI.", 422);
  const config = (fila.config ?? {}) as ConfigIntegracion;
  if (input.encendido && typeof config.ultimaPruebaEn !== "string") {
    throw new ErrorDeApp("Manda un evento de prueba exitoso antes de encender Meta CAPI.", 422);
  }
  // Encender CAPI decide si salen datos personales con hash hacia Meta: quien y cuando queda en change_log.
  const cambios = ([["datasetId", config.datasetId ?? null, datasetId], ["encendido", config.encendido ?? false, input.encendido]] as const)
    .filter(([, antes, despues]) => textoDeBitacora(antes) !== textoDeBitacora(despues));
  const p = await programa(db, programId);
  await db.transaction(async (tx) => {
    await tx.update(integraciones).set({
      config: { ...config, datasetId, encendido: input.encendido },
      actualizadaPorUserId: actorId, updatedAt: new Date(),
    }).where(eq(integraciones.id, fila.id));
    if (cambios.length > 0) {
      await tx.insert(changeLog).values(cambios.map(([campo, antes, despues]) => ({
        tabla: "integraciones", registroId: fila.id, etiqueta: `${p.nombre} · ${INTEGRACIONES.meta_capi.nombre}`, campo,
        valorAnterior: textoDeBitacora(antes), valorNuevo: textoDeBitacora(despues), origen: "app" as const, userId: actorId,
      })));
    }
  });
}

export async function registrarPruebaMetaCapi(db: Db, actorId: string, programId: string, ahora: Date): Promise<void> {
  const [fila] = await db.select({ config: integraciones.config }).from(integraciones)
    .where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, "meta_capi")));
  if (!fila) throw new ErrorDeApp("Primero conecta Meta CAPI.", 422);
  await db.update(integraciones).set({
    config: { ...((fila.config ?? {}) as ConfigIntegracion), ultimaPruebaEn: ahora.toISOString() },
    actualizadaPorUserId: actorId, updatedAt: ahora,
  }).where(and(eq(integraciones.programId, programId), eq(integraciones.tipo, "meta_capi")));
}

export type EstadoIntegracion = {
  tipo: TipoIntegracion; nombre: string; campo: string; configurada: boolean;
  probadaEn: Date | null; config: ConfigIntegracion; actualizadaEn: Date | null;
  webhookConectado?: boolean;
};

export async function estadoDeIntegraciones(db: Db, programId: string): Promise<EstadoIntegracion[]> {
  const filas = await db.select({
    tipo: integraciones.tipo, probadaEn: integraciones.probadaEn,
    config: integraciones.config, actualizadaEn: integraciones.updatedAt,
    webhookConectado: sql<boolean>`${integraciones.secretos} ? 'claveFirma'`,
  }).from(integraciones).where(eq(integraciones.programId, programId)).orderBy(asc(integraciones.createdAt));
  const porTipo = new Map(filas.map((fila) => [fila.tipo, fila]));
  return (Object.keys(INTEGRACIONES) as TipoIntegracion[]).map((tipo) => {
    const fila = porTipo.get(tipo);
    return {
      tipo, nombre: INTEGRACIONES[tipo].nombre, campo: INTEGRACIONES[tipo].campo,
      configurada: Boolean(fila), probadaEn: fila?.probadaEn ?? null,
      config: (fila?.config ?? {}) as ConfigIntegracion, actualizadaEn: fila?.actualizadaEn ?? null,
      ...(tipo === "calendly" ? { webhookConectado: fila?.webhookConectado ?? false } : {}),
    };
  });
}
