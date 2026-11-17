import type { Db } from "@/lib/db/tipos";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { dealsDeProximaCohorte, vistaProximaCohorte } from "@/lib/queries/proxima-cohorte";

type Busqueda = Record<string, string | string[] | undefined>;

export async function cargarDatosDeProximaCohorte(db: Db, entrada: { programId: string; busqueda: Busqueda }) {
  const vista = vistaProximaCohorte(entrada.busqueda.vista);
  const [deals, cohortes] = await Promise.all([
    dealsDeProximaCohorte(db, entrada.programId, vista),
    listarCohortes(db, entrada.programId),
  ]);
  return { vista, deals, cohortes };
}
