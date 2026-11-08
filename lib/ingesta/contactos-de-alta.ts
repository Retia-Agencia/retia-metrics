import type { Db } from "@/lib/db/tipos";
import { leadContactos } from "@/lib/db/schema";
import { normalizarTelefono } from "./envio";

/**
 * Los contactos de un lead dado de alta a mano (ticket 389, N6): su correo (la llave del lead)
 * y su telefono si es valido, para que el dedup por telefono y la ficha lo vean igual que a uno
 * del formulario. Sin envio que citar (`submission_id` nulo, como dice el esquema). Devuelve la
 * sentencia para que el alta la meta en SU transaccion; el unico escritor de `lead_contactos`
 * fuera de `ingerirEntradas` es este archivo. Vive aparte de `ingerir.ts` a proposito: el alta manual no
 * debe arrastrar la ingesta entera (regla de deals, Calendly) al importarlo. Un telefono que ya es de otro lead del programa se salta sin error
 * (indice unico), igual que en la ingesta.
 */
export function insertarContactosDeAlta(
  tx: Db,
  alta: { leadId: string; programId: string; correo: string; telefono: string | null | undefined },
) {
  const telefono = normalizarTelefono(alta.telefono);
  const base = { leadId: alta.leadId, programId: alta.programId, submissionId: null, esPrincipal: true, confirmado: true };
  const filas = [
    { ...base, tipo: "correo" as const, valor: alta.correo },
    ...(telefono ? [{ ...base, tipo: "telefono" as const, valor: telefono }] : []),
  ];
  return tx.insert(leadContactos).values(filas).onConflictDoNothing();
}
