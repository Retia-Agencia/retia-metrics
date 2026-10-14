import { z } from "zod";

export const fechaBogotaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(esFechaCalendario, {
  message: "Fecha inválida.",
});

export function desplazarFecha(fecha: string, dias: number): string {
  const fechaValida = fechaBogotaSchema.parse(fecha);
  const [anio, mes, dia] = fechaValida.split("-").map(Number);
  const instante = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return formarFecha(instante.getUTCFullYear(), instante.getUTCMonth() + 1, instante.getUTCDate());
}

function esFechaCalendario(fecha: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return false;
  const [, anioTexto, mesTexto, diaTexto] = partes;
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const instante = new Date(0);
  instante.setUTCHours(0, 0, 0, 0);
  instante.setUTCFullYear(anio, mes - 1, dia);
  return instante.getUTCFullYear() === anio
    && instante.getUTCMonth() === mes - 1
    && instante.getUTCDate() === dia;
}

function formarFecha(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
