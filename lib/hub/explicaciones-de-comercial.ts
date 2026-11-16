/** Fichas de Comercial, resueltas una vez por petición, sin consultas. */
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { ExplicacionesDeComercial } from "@/lib/hub/cifras-de-comercial";

export function explicacionesDeComercial(): ExplicacionesDeComercial {
  return {
    citas: explicacionDe("citas", { universo: "todas" }),
    asistencia: explicacionDe("asistencia", { universo: "todas" }),
    cierre_de_ventas: explicacionDe("cierre_de_ventas", { universo: "todas" }),
    cita_a_venta: explicacionDe("cita_a_venta", { universo: "todas" }),
    citas_sin_marcar: explicacionDe("citas_pendientes", { universo: "todas" }),
    vendido: explicacionDe("vendido", { universo: "todas" }),
    recaudado: explicacionDe("recaudado", { universo: "todas" }),
    por_cobrar: explicacionDe("por_cobrar", { universo: "todas" }),
  };
}
