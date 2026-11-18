/** Texto de las fichas que pinta Mi espacio › Métricas, con el universo «tuyas» (DC-4). */
import type { ExplicacionesDeMiEspacio } from "@/lib/hub/cifras-de-mi-espacio";
import { explicacionDe } from "@/lib/metricas/explicacion";

export function explicacionesDeMiEspacio(): ExplicacionesDeMiEspacio {
  const tuyas = { universo: "tuyas" } as const;
  return {
    citas: explicacionDe("citas", tuyas),
    shows: explicacionDe("shows", tuyas),
    no_asistio: explicacionDe("no_asistio", tuyas),
    ventas: explicacionDe("ventas", tuyas),
    cierre_de_ventas: explicacionDe("cierre_de_ventas", tuyas),
    citas_pendientes: explicacionDe("citas_pendientes", tuyas),
    comision: explicacionDe("comision", { ...tuyas, moneda: "usd" }),
    entro_a_caja: explicacionDe("entro_a_caja", { ...tuyas, moneda: "usd" }),
  };
}
