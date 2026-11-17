import { asc, eq } from "drizzle-orm";
import { cuentasPublicitarias, pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { OpcionDeCorte } from "./corte-de-pauta";

/** Lectura liviana compartida por el selector y la validación de la URL; nunca trae datos personales. */
export function opcionesDeCorteDePauta(db: Db, programId: string): Promise<OpcionDeCorte[]> {
  return unaVezPorSolicitud(db, claveDe("opcionesDeCorteDePauta", programId), async () => {
    const [cuentas, objetos] = await Promise.all([
      db.select({ id: cuentasPublicitarias.id, nombre: cuentasPublicitarias.nombre }).from(cuentasPublicitarias)
        .where(eq(cuentasPublicitarias.programId, programId)).orderBy(asc(cuentasPublicitarias.nombre), asc(cuentasPublicitarias.id)),
      db.select({ id: pautaObjetos.id, nivel: pautaObjetos.nivel, nombre: pautaObjetos.nombre, idMeta: pautaObjetos.idMeta })
        .from(pautaObjetos).where(eq(pautaObjetos.programId, programId)).orderBy(asc(pautaObjetos.nombre), asc(pautaObjetos.id)),
    ]);
    return [...cuentas.map((c) => ({ ...c, nivel: "cuenta_meta" as const, idMeta: c.id })), ...objetos];
  });
}
