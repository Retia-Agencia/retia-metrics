import { and, eq, isNotNull } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import { vigente } from "@/lib/queries/vigente";
import { leerYGuardarTranscript } from "./transcripciones";

/**
 * Programa la lectura del transcript para DESPUES de responder (ADR 0112 punto 2): la ficha
 * no espera a Grain. Se llama desde la server action que guardo `calls.link_grain`, nunca
 * dentro de la transaccion. Una falla ya queda guardada por `leerYGuardarTranscript`; lo que
 * escape de aqui es un bug nuestro y se registra sin tumbar nada, porque el cron reintenta.
 */
export function programarLecturaDeGrain(callId: string): void {
  after(async () => {
    try {
      await leerYGuardarTranscript(db, callId);
    } catch (error) {
      console.error("grain: la lectura despues de responder fallo", callId, error instanceof Error ? error.message : error);
    }
  });
}

/**
 * Igual, para quien no conoce el id de la llamada (mover un deal a Atendido con el link puede
 * crear la llamada en la misma operacion): lee las del deal que tengan link de Grain y aun no
 * tengan transcript bueno de ese link. `leerYGuardarTranscript` es idempotente.
 */
export function programarLecturaDeGrainDelDeal(dealId: string): void {
  after(async () => {
    try {
      const filas = await db
        .select({ id: calls.id })
        .from(calls)
        .where(and(eq(calls.dealId, dealId), isNotNull(calls.linkGrain), vigente(calls)));
      for (const { id } of filas) await leerYGuardarTranscript(db, id);
    } catch (error) {
      console.error("grain: la lectura del deal despues de responder fallo", dealId, error instanceof Error ? error.message : error);
    }
  });
}
