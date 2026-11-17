import type { Db } from "@/lib/db/tipos";
import { filtrosDeLeads } from "@/lib/queries/filtros-de-leads";
import { leadsDelPrograma, posiblesDuplicadosDelPrograma, preguntasDisponiblesDelPrograma, respuestasDelUltimoEnvio } from "@/lib/queries/leads";

type Busqueda = Record<string, string | string[] | undefined>;

export async function cargarDatosDeLeads(db: Db, entrada: { programId: string; busqueda: Busqueda; pagina: number; paginaDuplicados: number; duenoUserId?: string }) {
  const { filtro, filtroDeFecha } = filtrosDeLeads(entrada.busqueda, entrada.pagina);
  const [{ total, filas }, duplicados, preguntasFormulario] = await Promise.all([
    leadsDelPrograma(db, entrada.programId, filtro),
    posiblesDuplicadosDelPrograma(db, entrada.programId, { duenoUserId: entrada.duenoUserId, pagina: entrada.paginaDuplicados }),
    preguntasDisponiblesDelPrograma(db, entrada.programId),
  ]);
  const respuestasPorLead = Object.fromEntries(await respuestasDelUltimoEnvio(db, entrada.programId, filas.map((fila) => fila.id)));
  return { filtro, filtroDeFecha, total, filas, duplicados, preguntasFormulario, respuestasPorLead };
}
