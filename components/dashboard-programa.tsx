import type { ReactNode } from "react";
import type { CargarResumenDePunto } from "@/components/graficas/resumen-de-punto";
import { Dinero } from "@/components/dashboard/dinero";
import { Operacion } from "@/components/dashboard/operacion";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import type { VistaDeEscalera } from "@/lib/queries/vista-escalera";
import type { DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import type { OrigenEmbudoComercial } from "@/lib/queries/embudo-comercial";
import type { PasoComercialConDetalle } from "@/components/dashboard/operacion";
import type { DetallesDeOperacion, DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import type { SeriesDeDinero } from "@/lib/queries/series-dinero";

export { textoComisionPrograma } from "@/components/dashboard/operacion";

/**
 * Pinta UNA sección comercial del dashboard (ticket 197): el dashboard es una pantalla fija
 * con cada sección en su pestaña (`?seccion=`), así que `seccion` decide cuál se arma. No
 * calcula cifras.
 *
 * Hoy (252) y Pauta viven en sus propios componentes, así que acá solo caben Comercial
 * (`operacion`) y `dinero`.
 *
 * Dos reglas de dominio se ven en cada sección:
 *  - La moneda va al lado del monto y nunca se convierte ni se suma con otra.
 *  - Lo que no se sabe se dice: una tasa sin base sale como "—", nunca como cero.
 */
export function DashboardPrograma({
  seccion,
  vista,
  detalles,
  detallesOperacion,
  slug,
  dealsContraAgendas,
  seriesDinero,
  cargarResumenDePunto,
  origen,
  veEquipo = true,
  hoy,
  dealsContraAgendasVista,
  embudoComercial,
  origenEmbudo,
  enlacesDeOrigen,
  vistaEscalera,
  dineroPorCloser,
}: {
  seccion: "operacion" | "dinero";
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
  slug: string;
  dealsContraAgendas: ReactNode;
  seriesDinero?: SeriesDeDinero;
  /** La server action del resumen de un punto de Dinero (380); la pasa la página. */
  cargarResumenDePunto?: CargarResumenDePunto;
  origen: string;
  /**
   * Si la sesión ve el trabajo del equipo comercial (`veEquipoComercial`, ticket 102). Sin él
   * (paid trafficker) no se pintan el comparativo, la comisión, los abiertos por owner ni los
   * enlaces a Metas, Programa o una lista.
   */
  veEquipo?: boolean;
  /** El día de hoy en Bogotá: Comercial dice "hoy" en el contexto de cada cifra (ticket 372). */
  hoy: string;
  /** Los deals partidos por origen y los registros: las dos primeras filas del embudo (372). */
  dealsContraAgendasVista?: VistaDealsContraAgendas;
  embudoComercial?: PasoComercialConDetalle[];
  origenEmbudo?: "todos" | OrigenEmbudoComercial;
  enlacesDeOrigen?: Record<"todos" | "completo" | "parcial", string>;
  vistaEscalera?: VistaDeEscalera;
  dineroPorCloser?: Record<string, DineroDeVentas>;
}) {
  if (seccion === "operacion") {
    return (
      <Operacion
        vista={vista}
        detalles={detalles}
        detallesOperacion={detallesOperacion}
        dealsContraAgendas={dealsContraAgendas}
        veEquipo={veEquipo}
        hoy={hoy}
        dealsContraAgendasVista={dealsContraAgendasVista}
        embudoComercial={embudoComercial}
        origenEmbudo={origenEmbudo}
        enlacesDeOrigen={enlacesDeOrigen}
        vistaEscalera={vistaEscalera}
        dineroPorCloser={dineroPorCloser}
      />
    );
  }
  return <Dinero vista={vista} detalles={detalles} slug={slug} series={seriesDinero} origen={origen} hoy={hoy} veEquipo={veEquipo} cargarResumenDePunto={cargarResumenDePunto} />;
}
