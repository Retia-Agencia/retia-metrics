import type { ReporteDiario } from "@/lib/queries/reporte-diario";
import type { DetalleDeCifra, DetallesDeOperacion, DetallesDelDashboard } from "@/lib/queries/vista-metrica";

/** Un programa del reporte de Hoy con sus listas. Las listas faltan en la vista de "todos los programas". */
export interface ProgramaDelReporte {
  programa: { id: string; slug: string; nombre: string };
  reporte: ReporteDiario;
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
  /** Los leads del día: la lista de "registros" acotada al día del reporte. */
  detalleRegistros?: DetalleDeCifra;
  /** Las citas que ya debían ocurrir: la lista que sustenta la asistencia (el denominador). */
  detalleCitasDebidas?: DetalleDeCifra;
  /** Las listas de lo que llevamos en la semana, ya armadas por la página con `urlDeLista`. */
  enlacesDeLaSemana?: { cupos: string; leads: string; asistencia: string };
}
