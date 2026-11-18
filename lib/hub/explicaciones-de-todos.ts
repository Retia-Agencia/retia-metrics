/** Texto de las fichas que pinta `/hub` (todos los programas), con el universo de esa pantalla: todas las áreas. */
import type { ExplicacionesDeConteosDeTodos } from "@/lib/hub/cifras-de-todos";
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { ExplicacionDeConcepto } from "@/lib/metricas/cifra";

export function explicacionesDeConteosDeTodos(): ExplicacionesDeConteosDeTodos {
  return {
    leads: explicacionDe("leads", { universo: "todas" }),
    citas: explicacionDe("citas", { universo: "todas" }),
    shows: explicacionDe("shows", { universo: "todas" }),
    ventas: explicacionDe("ventas", { universo: "todas" }),
  };
}

export function explicacionesDeTasasDeTodos(): { asistencia: ExplicacionDeConcepto; cierre_de_ventas: ExplicacionDeConcepto } {
  return {
    asistencia: explicacionDe("asistencia", { universo: "todas" }),
    cierre_de_ventas: explicacionDe("cierre_de_ventas", { universo: "todas" }),
  };
}
