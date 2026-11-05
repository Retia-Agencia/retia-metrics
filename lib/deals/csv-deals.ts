/**
 * El CSV de "Descargar deals": una fila por deal con lo básico del lead. El teléfono va
 * primero entre los datos de contacto porque es lo que más se usa al llamar. Puro: sin base.
 */
export interface FilaCsvDeal {
  nombre: string | null;
  telefono: string | null;
  correo: string | null;
  etapa: string;
  pendiente: string | null;
  dueno: string | null;
  cohorte: string | null;
  pais: string | null;
  ciudad: string | null;
  calidad: string | null;
  valor: string | null;
  origen: string | null;
  creado: string | null;
  linkCrm: string;
}

const ENCABEZADOS = [
  "Nombre", "Teléfono", "Correo", "Etapa", "Pendiente", "Dueño", "Cohorte",
  "País", "Ciudad", "Calidad", "Valor", "Origen (UTM)", "Creado", "Link CRM",
] as const;

function celdaCsv(valor: string | null): string {
  let texto = valor ?? "";
  // Una celda que empieza con = + - @ se ejecuta como fórmula en Excel.
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
}

/** CSV para Excel: UTF-8 con BOM, CRLF y todas las celdas citadas. */
export function csvDeDeals(filas: readonly FilaCsvDeal[]): string {
  const lineas = [
    ENCABEZADOS.map(celdaCsv).join(","),
    ...filas.map((f) =>
      [
        f.nombre, f.telefono, f.correo, f.etapa, f.pendiente, f.dueno, f.cohorte,
        f.pais, f.ciudad, f.calidad, f.valor, f.origen, f.creado, f.linkCrm,
      ]
        .map(celdaCsv)
        .join(","),
    ),
  ];
  return `﻿${lineas.join("\r\n")}`;
}
