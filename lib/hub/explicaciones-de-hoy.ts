/** Fichas de Hoy: una resolución por petición, sin texto paralelo ni consultas. */
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { ExplicacionesDeHoy } from "@/lib/hub/cifras-de-hoy";
import type { ExplicacionesDeClosersDeHoy } from "@/lib/hub/cifras-de-pendientes-y-closers";

export function explicacionesDeHoy(): ExplicacionesDeHoy {
  return {
    cupos_vendidos: explicacionDe("cupos_vendidos", { universo: "todas" }),
    leads: explicacionDe("leads", { universo: "todas" }),
    leads_que_hacen_falta: explicacionDe("leads_que_hacen_falta", { universo: "todas" }),
    entro_a_caja: explicacionDe("entro_a_caja", { universo: "todas", moneda: "usd" }),
    asistencia: explicacionDe("asistencia", { universo: "todas" }),
    cierre_de_ventas: explicacionDe("cierre_de_ventas", { universo: "todas" }),
    citas_sin_marcar: explicacionDe("citas_pendientes", { universo: "todas" }),
    registros: explicacionDe("registros", { universo: "todas" }),
    citas_del_dia: explicacionDe("citas_del_dia", { universo: "todas" }),
    citas_realizadas: explicacionDe("shows", { universo: "todas" }),
    citas_canceladas: explicacionDe("citas_canceladas", { universo: "todas" }),
    citas_pendientes: explicacionDe("citas_pendientes", { universo: "todas" }),
    vendido: explicacionDe("vendido", { universo: "todas" }),
    recaudado: explicacionDe("recaudado", { universo: "todas" }),
    por_cobrar: explicacionDe("por_cobrar", { universo: "todas" }),
    llevamos: explicacionDe("llevamos", { universo: "todas" }),
    show_por_cita: explicacionDe("show_por_cita", { universo: "todas" }),
    citas_de_manana: explicacionDe("citas_del_dia", { universo: "todas" }),
  };
}

export function explicacionesDeClosersDeHoy(x: ExplicacionesDeHoy): ExplicacionesDeClosersDeHoy {
  return {
    citas: explicacionDe("citas", { universo: "todas" }),
    asistencia: x.asistencia,
    ventas: explicacionDe("ventas", { universo: "todas" }),
    cierre_de_ventas: x.cierre_de_ventas,
    entro_a_caja: x.entro_a_caja,
  };
}
