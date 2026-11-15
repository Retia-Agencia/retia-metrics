/** Texto de las fichas de Dinero, con el universo que muestra esta pestaña. */
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { ExplicacionesDeDinero } from "@/lib/hub/cifras-de-dinero";

export function explicacionesDeDinero(): ExplicacionesDeDinero {
  return {
    vendido: explicacionDe("vendido", { universo: "todas" }),
    recaudado: explicacionDe("recaudado", { universo: "todas" }),
    por_cobrar: explicacionDe("por_cobrar", { universo: "todas" }),
    entro_a_caja: explicacionDe("entro_a_caja", { universo: "todas", moneda: "usd" }),
    ventas: explicacionDe("ventas", { universo: "todas" }),
  };
}
