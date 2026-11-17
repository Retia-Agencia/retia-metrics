import type { ProgramaVisible } from "@/lib/auth/alcance";
import type { Db } from "@/lib/db/tipos";
import { armarReporteDiario } from "@/lib/queries/reporte-diario";
import { sinListas } from "@/lib/queries/vista-metrica";

export async function cargarDatosDeReporteDelHub(db: Db, entrada: { programas: ProgramaVisible[]; dia: string; puedeVerEquipo: boolean }) {
  return Promise.all(entrada.programas.map(async (programa) => {
    const reporte = await armarReporteDiario({ programId: programa.id, dia: entrada.dia }, db);
    return { programa, reporte: entrada.puedeVerEquipo ? reporte : sinListas(reporte) };
  }));
}
