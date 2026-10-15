import { esDiaHabil } from "@/lib/dias-habiles";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import type { MetricaDelReporte } from "@/lib/catalogo/reportes-whatsapp";

export interface ReporteConfig {
  programId: string;
  activo: boolean;
  destino: string | null;
  horas: number[];
  horaCierre: number | null;
  metricas: MetricaDelReporte[];
}

export interface ReportePendiente {
  programId: string;
  destino: string;
  tipo: "dia" | "cierre";
  hora: `${string}:00`;
  metricas: MetricaDelReporte[];
}

const horaEnBogota = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Regla pura que Juanito consulta: no lee la base ni mezcla programas. */
export function queTocaAhora(instante: Date, reportes: ReporteConfig[]): ReportePendiente[] {
  if (!esDiaHabil(fechaDeInstanteEnBogota(instante))) return [];
  const [horaTexto, minutoTexto] = horaEnBogota.format(instante).split(":");
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  if (minuto >= 15) return [];

  return reportes.flatMap((reporte) => {
    if (!reporte.activo || !reporte.destino || reporte.metricas.length === 0) return [];
    const tipo = reporte.horaCierre === hora
      ? "cierre"
      : reporte.horas.includes(hora)
        ? "dia"
        : null;
    if (!tipo) return [];
    return [{
      programId: reporte.programId,
      destino: reporte.destino,
      tipo,
      hora: `${horaTexto}:00` as const,
      metricas: reporte.metricas,
    }];
  });
}
