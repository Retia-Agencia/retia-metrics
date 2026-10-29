import { fechaHoraEnBogota } from "@/lib/format";
import type { VistaRoasDePauta } from "@/lib/queries/roas-de-pauta";

export const COLUMNAS_CSV_CITAS_PAUTA = ["fecha_hora_bogota", "resultado", "campana", "conjunto", "anuncio", "canal"] as const;

const celda = (valor: unknown) => {
  const texto = String(valor ?? "");
  return /[",\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
};

/** CSV deliberadamente anónimo: el tipo no acepta ninguna columna de persona o deal. */
export function csvDeCitasPauta(vista: VistaRoasDePauta): string {
  const filas = vista.envios.flatMap((envio) => envio.citas.map((cita) => [
    fechaHoraEnBogota(cita.fecha), cita.resultado, envio.campanaNombre ?? "Sin anuncio",
    envio.conjuntoNombre ?? "Sin anuncio", envio.anuncioNombre ?? "Sin anuncio", envio.canal,
  ]));
  return `\uFEFF${[COLUMNAS_CSV_CITAS_PAUTA, ...filas].map((fila) => fila.map(celda).join(",")).join("\r\n")}\r\n`;
}
