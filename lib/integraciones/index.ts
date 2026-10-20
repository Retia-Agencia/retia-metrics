import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { integraciones, programs, type TipoIntegracion } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { INTEGRACIONES, probarIntegracion } from "./registro";
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
  input: { actorId: string; programId: string; tipo: TipoIntegracion; secretos: Secretos; config?: Record<string, string>; probadaEn?: Date | null; campo: string },
) {
  const [actual] = await db.select({
    id: integraciones.id, secretos: integraciones.secretos,
    config: integraciones.config, probadaEn: integraciones.probadaEn,
  })
    .from(integraciones).where(and(eq(integraciones.programId, input.programId), eq(integraciones.tipo, input.tipo)));
  const p = await programa(db, input.programId);
  const id = actual?.id ?? crypto.randomUUID();
  const secretos = { ...((actual?.secretos ?? {}) as Secretos), ...input.secretos };
  const [guardada] = await db.insert(integraciones).values({
    id, programId: input.programId, tipo: input.tipo, secretos,
    config: input.config ?? actual?.config ?? {}, probadaEn: input.probadaEn ?? actual?.probadaEn ?? null,
    actualizadaPorUserId: input.actorId, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [integraciones.programId, integraciones.tipo],
    set: {
      secretos, config: input.config ?? actual?.config ?? {},
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
): Promise<Record<string, string>> {
  return normalizando(async () => {
    const definicion = INTEGRACIONES[tipo];
    const valor = definicion.esquema.parse(valorCrudo);
    const config = await probarIntegracion(tipo, valor, f);
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
): Promise<Record<string, string>> {
  const definicion = INTEGRACIONES[tipo];
  const valor = await secreto(db, programId, tipo, definicion.llave);
  if (!valor) throw new ErrorDeApp(`Primero conecta ${definicion.nombre} en Integraciones.`, 422);
  let config: Record<string, string>;
  try {
    config = await probarIntegracion(tipo, valor, f);
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

export type EstadoIntegracion = {
  tipo: TipoIntegracion; nombre: string; campo: string; configurada: boolean;
  probadaEn: Date | null; config: Record<string, string>; actualizadaEn: Date | null;
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
      config: (fila?.config ?? {}) as Record<string, string>, actualizadaEn: fila?.actualizadaEn ?? null,
      ...(tipo === "calendly" ? { webhookConectado: fila?.webhookConectado ?? false } : {}),
    };
  });
}
