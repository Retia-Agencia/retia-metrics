import type { ReactNode } from "react";
import { Dinero } from "@/components/dashboard/dinero";
import { Operacion } from "@/components/dashboard/operacion";
import { Pulso } from "@/components/dashboard/pulso";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetallesDelDashboard } from "@/lib/queries/vista-metrica";

export { OrigenPorCanal } from "@/components/dashboard/origen-por-canal";
export { textoComisionPrograma } from "@/components/dashboard/operacion";

/**
 * Compone las tres preguntas comerciales del dashboard sin calcular cifras.
 *
 * Dos reglas de dominio se ven en cada sección:
 *  - La moneda va al lado del monto y nunca se convierte ni se suma con otra.
 *  - Lo que no se sabe se dice: una tasa sin base sale como "—", nunca como cero.
 */
export function DashboardPrograma({
  vista,
  detalles,
  slug,
  dealsContraAgendas,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  slug: string;
  dealsContraAgendas: ReactNode;
}) {
  return (
    <div className="space-y-10">
      <Pulso vista={vista} detalles={detalles} slug={slug} />
      <Operacion
        vista={vista}
        detalles={detalles}
        dealsContraAgendas={dealsContraAgendas}
      />
      <Dinero vista={vista} detalles={detalles} slug={slug} />
    </div>
  );
}
