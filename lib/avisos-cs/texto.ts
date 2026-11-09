import { monto } from "@/lib/format";

export interface DatosDeAvisoEstudianteNuevo {
  programa: string;
  nombre: string | null;
  telefono: string | null;
  correo: string | null;
  cohorte: string | null;
  etapa: "ganado_parcial" | "ganado_completo";
  abonado: number | null;
  moneda: string;
  enlace: string;
}

/** Texto plano que Juanito envia sin completar ni reinterpretar campos. */
export function textoDeAvisoEstudianteNuevo(datos: DatosDeAvisoEstudianteNuevo): string {
  const etapa = datos.etapa === "ganado_completo" ? "pago completo" : "pago parcial";
  return [
    `🎓 Estudiante nuevo · ${datos.programa}`,
    `Nombre: ${datos.nombre ?? "—"}`,
    `Celular: ${datos.telefono ?? "—"}`,
    `Correo: ${datos.correo ?? "—"}`,
    `Cohorte: ${datos.cohorte ?? "—"}`,
    `Etapa: ${etapa}`,
    `Monto abonado: ${datos.abonado === null ? "—" : monto(datos.abonado, datos.moneda)}`,
    `Deal: ${datos.enlace}`,
  ].join("\n");
}
