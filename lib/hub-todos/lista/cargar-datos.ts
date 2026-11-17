import type { ProgramaVisible } from "@/lib/auth/alcance";
import type { Db } from "@/lib/db/tipos";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import type { PeriodoResuelto } from "@/lib/periodo";

export function cargarDatosDeListaDelHub(db: Db, entrada: { programas: ProgramaVisible[]; metrica: Metrica; periodo: PeriodoResuelto; hoy: string; moneda?: string; pagina: number }) {
  return listaDeMetrica(entrada.metrica, { programId: entrada.programas.map((programa) => programa.id), rango: entrada.periodo.a, hoy: entrada.hoy, moneda: entrada.moneda }, entrada.pagina, db);
}
