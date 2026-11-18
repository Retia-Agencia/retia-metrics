import { eq } from "drizzle-orm";
import { pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";

export function objetosParaAtribucionDePauta(db: Db, programId: string) {
  return unaVezPorSolicitud(db, claveDe("objetosDePautaParaRoas", programId), () =>
    db.select({ idMeta: pautaObjetos.idMeta, nombre: pautaObjetos.nombre, nivel: pautaObjetos.nivel,
      padreIdMeta: pautaObjetos.padreIdMeta, cuentaId: pautaObjetos.cuentaId }).from(pautaObjetos).where(eq(pautaObjetos.programId, programId)));
}
