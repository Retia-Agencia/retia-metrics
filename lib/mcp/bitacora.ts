import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { ZodError } from "zod";
import { mcpLlamadas } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export const TOPE_POR_MINUTO = 300;

export interface EntradaDeLlamada {
  tokenId: string;
  userId: string;
  userIdVista: string | null;
  herramienta: string;
  programId: string | null;
  resultado: "ok" | "error" | "denegado" | "tope";
  codigoError: string | null;
  duracionMs: number;
  cliente: string | null;
}

export async function registrarLlamada(db: Db, entrada: EntradaDeLlamada): Promise<void> {
  await db.insert(mcpLlamadas).values(entrada);
}

export async function segundosDeEspera(
  db: Db,
  tokenId: string,
  ahora: Date,
): Promise<number | null> {
  // La lectura y la insercion no forman una reserva atomica: se acepta un margen pequeno bajo rafaga.
  const desde = new Date(ahora.getTime() - 60_000);
  const filas = await db
    .select({ creadoEn: mcpLlamadas.creadoEn })
    .from(mcpLlamadas)
    .where(and(eq(mcpLlamadas.tokenId, tokenId), gte(mcpLlamadas.creadoEn, desde)))
    .orderBy(asc(mcpLlamadas.creadoEn))
    .limit(TOPE_POR_MINUTO);
  if (filas.length < TOPE_POR_MINUTO) return null;
  return Math.max(1, Math.ceil((filas[0].creadoEn.getTime() + 60_000 - ahora.getTime()) / 1000));
}

export async function purgarLlamadasAntiguas(db: Db, dias = 90, ahora = new Date()): Promise<number> {
  const limite = new Date(ahora.getTime() - dias * 24 * 60 * 60_000);
  const borradas = await db.delete(mcpLlamadas).where(lt(mcpLlamadas.creadoEn, limite)).returning();
  return borradas.length;
}

/**
 * El código con que queda un rechazo de entrada en la bitácora (ticket 400): `ENTRADA_INVALIDA:` y los
 * campos que fallaron (ruta del esquema, nunca el valor que mandó el cliente: puede traer nombres o correos).
 * Una clave que el esquema no conoce se anota como `clave_desconocida`, sin copiar su nombre.
 */
export function codigoDeEntradaInvalida(error: ZodError): string {
  const campos = new Set<string>();
  for (const issue of error.issues) {
    campos.add(issue.code === "unrecognized_keys" ? "clave_desconocida" : issue.path.join(".") || "entrada");
  }
  return `ENTRADA_INVALIDA:${[...campos].sort().join(",")}`.slice(0, 200);
}
