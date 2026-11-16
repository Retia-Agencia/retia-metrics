import { and, asc, eq, inArray } from "drizzle-orm";
import { comprasPasarela } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export function pagosPendientes(db: Db, programId: string) {
  return db.select({
    id: comprasPasarela.id,
    estado: comprasPasarela.estado,
    motivoRevision: comprasPasarela.motivoRevision,
    nombre: comprasPasarela.nombre,
    correo: comprasPasarela.correo,
    telefono: comprasPasarela.telefono,
    monto: comprasPasarela.monto,
    moneda: comprasPasarela.moneda,
    createdAt: comprasPasarela.createdAt,
  }).from(comprasPasarela)
    .where(and(eq(comprasPasarela.programId, programId), inArray(comprasPasarela.estado, ["sin_emparejar", "en_revision"])))
    .orderBy(asc(comprasPasarela.createdAt));
}
