/** Fichas del norte, sin consultas y para todas las áreas del programa. */
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { ExplicacionesDelNorte } from "@/lib/hub/cifras-del-norte";

export function explicacionesDelNorte(): ExplicacionesDelNorte {
  return {
    llevamos: explicacionDe("llevamos", { universo: "todas" }),
    vendido: explicacionDe("vendido", { universo: "todas" }),
    faltan: explicacionDe("faltan", { universo: "todas" }),
    esperado_a_hoy: explicacionDe("esperado_a_hoy", { universo: "todas" }),
    por_dia_habil: explicacionDe("por_dia_habil", { universo: "todas" }),
    proyeccion: explicacionDe("proyeccion", { universo: "todas" }),
  };
}
