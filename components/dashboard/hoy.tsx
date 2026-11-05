import type { ReactNode } from "react";
import { Pendientes } from "@/components/dashboard/hoy/pendientes";
import { ReporteDiarioVista, type ProgramaDelReporte } from "@/components/dashboard/reporte-diario";
import type { Alerta } from "@/lib/queries/alertas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetalleDeCifra, DetallesDelDashboard } from "@/lib/queries/vista-metrica";

/**
 * Hub › Hoy (ticket 252, 373, 378, ADR 0086): el reporte diario en tarjetas (`ReporteDiarioVista`). Lo que
 * sirve para seguir el día (alertas, pendientes y mañana) entra como bloque solo cuando
 * el día es hoy y no va al PDF. Este componente no calcula ninguna cifra.
 */
export function Hoy({
  programas,
  dia,
  hoy,
  selector,
  vamosALlegar,
  vista,
  detalles,
  alertas,
  slug,
  veEquipo,
  detalleManana,
  configuracion,
  definirObjetivo,
}: {
  programas: ProgramaDelReporte[];
  dia: string;
  hoy: string;
  selector: ReactNode;
  vamosALlegar: ReactNode;
  /** La vista de HOY, para las banderas de pendientes. */
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  alertas: Alerta[];
  slug: string;
  /** Sin equipo comercial (paid trafficker): sin las tablas por closer ni los nombres. */
  veEquipo: boolean;
  detalleManana?: DetalleDeCifra;
  configuracion?: ReactNode;
  definirObjetivo?: ReactNode;
}) {
  // Lo que sirve para seguir el día vive de hoy hacia adelante: en un día pasado no se dibuja (373).
  const esHoy = dia === hoy;
  const reporte = programas[0].reporte;
  return (
    <ReporteDiarioVista
      programas={programas}
      dia={dia}
      hoy={hoy}
      veEquipo={veEquipo}
      selector={selector}
      vamosALlegar={vamosALlegar}
      configuracion={configuracion}
      definirObjetivo={definirObjetivo}
      pendientes={esHoy ? <Pendientes vista={vista} detalles={detalles} citasDeManana={reporte.citasDeManana.length} detalleManana={detalleManana} alertas={alertas} slug={slug} veEquipo={veEquipo} /> : undefined}
    />
  );
}
