import type { Session } from "next-auth";
import type { Db } from "@/lib/db/tipos";
import { tableroDeDealsParaActor } from "@/lib/queries/operacion";

type Busqueda = Record<string, string | string[] | undefined>;

export function cargarDatosDeDeals(db: Db, entrada: { programId: string; session: Session; busqueda: Busqueda; vistaRecordada: string | null }) {
  return tableroDeDealsParaActor(db, entrada.programId, entrada.session, entrada.busqueda, entrada.vistaRecordada);
}
