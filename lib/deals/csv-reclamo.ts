/**
 * Lectura y salida del CSV con el que un closer reclama deals. Este módulo es puro para
 * que el navegador haga el trabajo pesado antes de llamar al servidor.
 */
import { celdaCsv } from "@/lib/deals/csv-deals";
import { ErrorDeApp } from "@/lib/errors";
import { normalizarTelefono } from "@/lib/ingesta/envio";
import { MapeoInvalidoError, normalizarEmail } from "@/lib/sheets/mapeo";

const ENCABEZADOS_CORREO = ["correo", "email", "e-mail", "mail", "correo electronico"] as const;
const ENCABEZADOS_TELEFONO = ["celular", "telefono", "movil", "phone", "whatsapp", "numero"] as const;
const MAX_FILAS = 20_000;

export interface FilaDeReclamo {
  fila: number;
  correoOriginal: string;
  telefonoOriginal: string;
  correo: string | null;
  telefono: string | null;
}

export interface CsvDeReclamo {
  filas: FilaDeReclamo[];
}

export type CategoriaReclamoCsv =
  | "reclamable"
  | "ya_es_tuyo"
  | "de_otro"
  | "sin_dueno_fuera_de_setteo"
  | "sin_deal_abierto"
  | "no_esta"
  | "ambiguo"
  | "invalida"
  | "duplicada";

/** El resultado de una fila en palabras, para la vista previa y para el CSV descargable. */
export const ETIQUETA_DE_RESULTADO: Record<CategoriaReclamoCsv, string> = {
  reclamable: "Se puede reclamar",
  ya_es_tuyo: "Ya es tuyo",
  de_otro: "Está en el CRM y lo tiene otra persona",
  sin_dueno_fuera_de_setteo: "Está en el CRM sin dueño, fuera de Por settear",
  sin_deal_abierto: "Está en el CRM sin deal abierto",
  no_esta: "No está en el CRM",
  ambiguo: "Coincidencia ambigua",
  invalida: "Sin correo ni celular válido",
  duplicada: "Repetido en el archivo",
};

export interface ResultadoFilaReclamo extends Pick<FilaDeReclamo, "fila" | "correoOriginal" | "telefonoOriginal"> {
  categoria: CategoriaReclamoCsv;
  dealId: string | null;
  detalle: string;
}

function sinTildes(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function separadorDe(encabezado: string): "," | ";" {
  let comas = 0;
  let puntosYComas = 0;
  let enComillas = false;
  for (let i = 0; i < encabezado.length; i += 1) {
    if (encabezado[i] === '"') {
      if (enComillas && encabezado[i + 1] === '"') i += 1;
      else enComillas = !enComillas;
    } else if (!enComillas && encabezado[i] === ",") comas += 1;
    else if (!enComillas && encabezado[i] === ";") puntosYComas += 1;
  }
  return puntosYComas > comas ? ";" : ",";
}

function registrosCsv(texto: string, separador: "," | ";"): { fila: number; celdas: string[] }[] {
  const registros: { fila: number; celdas: string[] }[] = [];
  let celdas: string[] = [];
  let celda = "";
  let enComillas = false;
  let linea = 1;
  let inicio = 1;

  const cerrar = () => {
    celdas.push(celda);
    registros.push({ fila: inicio, celdas });
    celdas = [];
    celda = "";
  };

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];
    if (caracter === '"') {
      if (enComillas && texto[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else enComillas = !enComillas;
      continue;
    }
    if (caracter === separador && !enComillas) {
      celdas.push(celda);
      celda = "";
      continue;
    }
    if ((caracter === "\n" || caracter === "\r") && !enComillas) {
      cerrar();
      if (caracter === "\r" && texto[i + 1] === "\n") i += 1;
      linea += 1;
      inicio = linea;
      continue;
    }
    celda += caracter;
    if (caracter === "\n") linea += 1;
    else if (caracter === "\r") {
      if (texto[i + 1] === "\n") {
        celda += "\n";
        i += 1;
      }
      linea += 1;
    }
  }
  if (celda !== "" || celdas.length > 0) cerrar();
  return registros;
}

export function parsearCsvDeReclamo(texto: string): CsvDeReclamo {
  const limpio = texto.replace(/^\uFEFF/, "");
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? "";
  const registros = registrosCsv(limpio, separadorDe(primeraLinea));
  const encabezados = registros[0]?.celdas ?? [];
  const normalizados = encabezados.map(sinTildes);
  const correoIndice = normalizados.findIndex((v) => ENCABEZADOS_CORREO.includes(v as typeof ENCABEZADOS_CORREO[number]));
  const telefonoIndice = normalizados.findIndex((v) => ENCABEZADOS_TELEFONO.includes(v as typeof ENCABEZADOS_TELEFONO[number]));
  if (correoIndice < 0 && telefonoIndice < 0) {
    throw new MapeoInvalidoError(
      "correo o teléfono",
      [...ENCABEZADOS_CORREO, ...ENCABEZADOS_TELEFONO],
      encabezados,
    );
  }

  const datos = registros.slice(1).filter(({ celdas }) => celdas.some((celda) => celda.trim() !== ""));
  if (datos.length > MAX_FILAS) {
    throw new ErrorDeApp(`El CSV tiene más de ${MAX_FILAS.toLocaleString("es-CO")} filas de datos.`, 400);
  }
  return {
    filas: datos.map(({ fila, celdas }) => {
      const correoOriginal = correoIndice >= 0 ? (celdas[correoIndice] ?? "").trim() : "";
      const telefonoOriginal = telefonoIndice >= 0 ? (celdas[telefonoIndice] ?? "").trim() : "";
      return {
        fila,
        correoOriginal,
        telefonoOriginal,
        correo: normalizarEmail(correoOriginal),
        telefono: normalizarTelefono(telefonoOriginal),
      };
    }),
  };
}

/** La primera aparición de un deal se conserva; las siguientes no se reclaman dos veces. */
export function marcarDuplicados(resultados: readonly ResultadoFilaReclamo[]): ResultadoFilaReclamo[] {
  const primeraFila = new Map<string, number>();
  for (const resultado of resultados) {
    if (resultado.categoria !== "reclamable" || !resultado.dealId) continue;
    const actual = primeraFila.get(resultado.dealId);
    if (actual === undefined || resultado.fila < actual) primeraFila.set(resultado.dealId, resultado.fila);
  }
  return resultados.map((resultado) => {
    if (resultado.categoria !== "reclamable" || !resultado.dealId) return { ...resultado };
    if (primeraFila.get(resultado.dealId) === resultado.fila) return { ...resultado };
    return { ...resultado, categoria: "duplicada", dealId: null, detalle: "Este deal ya aparece en una fila anterior." };
  });
}

/** CSV de auditoría: únicamente las filas que no terminaron reclamadas. */
export function csvDeNoReclamados(resultados: readonly ResultadoFilaReclamo[]): string {
  const filas = resultados.filter((resultado) => resultado.categoria !== "reclamable");
  const lineas = [
    ["Fila", "Correo", "Teléfono", "Resultado", "Detalle"].map(celdaCsv).join(","),
    ...filas.map((resultado) => [
      String(resultado.fila),
      resultado.correoOriginal,
      resultado.telefonoOriginal,
      ETIQUETA_DE_RESULTADO[resultado.categoria],
      resultado.detalle,
    ].map(celdaCsv).join(",")),
  ];
  return `﻿${lineas.join("\r\n")}`;
}
