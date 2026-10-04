import type { ReactNode } from "react";
import { Dinero } from "@/components/dashboard/dinero";
import { Operacion } from "@/components/dashboard/operacion";
import { Pulso } from "@/components/dashboard/pulso";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetallesDelDashboard } from "@/lib/queries/vista-metrica";

export { OrigenPorCanal } from "@/components/dashboard/origen-por-canal";
export { textoComisionPrograma } from "@/components/dashboard/operacion";

/**
 * Pinta UNA sección comercial del dashboard (ticket 197): el dashboard es una pantalla fija
 * con cada sección en su pestaña (`?seccion=`), así que `seccion` decide cuál se arma. No
 * calcula cifras.
 *
 * La pestaña `pauta` vive en la página (no es un componente de sección del 148), así que acá
 * solo caben `pulso`, `operacion` y `dinero`.
 *
 * Dos reglas de dominio se ven en cada sección:
 *  - La moneda va al lado del monto y nunca se convierte ni se suma con otra.
 *  - Lo que no se sabe se dice: una tasa sin base sale como "—", nunca como cero.
 */
export function DashboardPrograma({
  seccion,
  vista,
  detalles,
  slug,
  dealsContraAgendas,
}: {
  seccion: "pulso" | "operacion" | "dinero";
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  slug: string;
  dealsContraAgendas: ReactNode;
}) {
  if (seccion === "pulso") {
    return <Pulso vista={vista} detalles={detalles} slug={slug} />;
  }
  if (seccion === "operacion") {
    return (
      <Operacion
        vista={vista}
        detalles={detalles}
        dealsContraAgendas={dealsContraAgendas}
      />
    );
  }
  return <Dinero vista={vista} detalles={detalles} slug={slug} />;
}
