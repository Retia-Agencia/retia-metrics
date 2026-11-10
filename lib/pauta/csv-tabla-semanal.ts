import { cop, fechaCorta, num, pct, usd } from "@/lib/format";
import type { CeldaPautaSemanal, FilaPautaSemanal, UnidadPautaSemanal, VistaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";

const escapar = (valor: unknown) => {
  const texto = String(valor ?? "");
  return /[",\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
};

export function etiquetaDeSemana(semana: { desde: string; hasta: string }): string {
  return semana.desde === semana.hasta
    ? fechaCorta(semana.desde)
    : `${fechaCorta(semana.desde)} a ${fechaCorta(semana.hasta)}`;
}

export function textoDeValorSemanal(valor: number, unidad: UnidadPautaSemanal): string {
  switch (unidad) {
    case "COP": return cop(valor);
    case "USD": return usd(valor);
    case "porcentaje": return pct(valor);
    case "razon": return `${num(valor, 2)}×`;
    case "conteo": return num(valor);
  }
}

export function textoDeCeldaSemanal(celda: CeldaPautaSemanal, fila: Pick<FilaPautaSemanal, "unidad">): string {
  return celda.valor === null ? "—" : textoDeValorSemanal(celda.valor, fila.unidad);
}

/** CSV con el mismo orden de filas y columnas que la tabla visible. */
export function csvDePautaSemanal(vista: VistaPautaSemanal): string {
  const encabezado = ["Métrica", "Total", ...vista.semanas.map(etiquetaDeSemana)];
  const filas = vista.filas.map((fila) => [
    fila.nombre,
    textoDeCeldaSemanal(fila.celdas.total, fila),
    ...fila.celdas.porSemana.map((celda) => textoDeCeldaSemanal(celda, fila)),
  ]);
  return `\uFEFF${[encabezado, ...filas].map((fila) => fila.map(escapar).join(",")).join("\r\n")}\r\n`;
}
