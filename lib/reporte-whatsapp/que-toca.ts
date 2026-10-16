import type { MetricaDelReporte } from "@/lib/catalogo/reportes-whatsapp";
import { MINUTOS_DE_GRACIA } from "@/lib/semaforo/semaforo";

export interface ReporteConfig {
  programId: string;
  activo: boolean;
  horas: number[];
  horaCierre: number | null;
  metricas: MetricaDelReporte[];
}

export interface ReportePendiente {
  programId: string;
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
  const [horaTexto, minutoTexto] = horaEnBogota.format(instante).split(":");
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);
  if (minuto >= MINUTOS_DE_GRACIA) return [];

  return reportes.flatMap((reporte) => {
    if (!reporte.activo || reporte.metricas.length === 0) return [];
    const tipo = reporte.horaCierre === hora
      ? "cierre"
      : reporte.horas.includes(hora)
        ? "dia"
        : null;
    if (!tipo) return [];
    return [{
      programId: reporte.programId,
      tipo,
      hora: `${horaTexto}:00` as const,
      metricas: reporte.metricas,
    }];
  });
}
