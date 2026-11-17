import type { Db } from "@/lib/db/tipos";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import { resolverFiltroStudents, studentsDelPrograma } from "@/lib/queries/estudiantes";
import { pagosDeStudents } from "@/lib/queries/pagos-de-students";

type Busqueda = Record<string, string | string[] | undefined>;
const uno = (valor: string | string[] | undefined) => Array.isArray(valor) ? valor[0] : valor;

export async function cargarDatosDeStudents(db: Db, entrada: { programId: string; busqueda: Busqueda }) {
  const cohortes = (await listarCohortes(db, entrada.programId)).sort((a, b) => (b.fechaInicioVentas ?? "").localeCompare(a.fechaInicioVentas ?? ""));
  const leadsCasan = await leadsQueCasan(db, entrada.programId, uno(entrada.busqueda.q) ?? "");
  const resuelto = resolverFiltroStudents({
    cohortes,
    cohorte: uno(entrada.busqueda.cohorte),
    onboarding: uno(entrada.busqueda.onboarding),
    orden: uno(entrada.busqueda.orden),
    leadsCasan,
  });
  const filas = await studentsDelPrograma(db, entrada.programId, resuelto.filtro);
  const pagos = await pagosDeStudents(db, entrada.programId, filas.map((fila) => fila.dealId));
  return { cohortes, ...resuelto, filas, pagos };
}
