export interface FilaCsvGrain {
  fechaLlamada: string | null;
  lead: string | null;
  correo: string | null;
  closer: string | null;
  resultado: string | null;
  etapaDeal: string | null;
  linkGrain: string | null;
  linkCrm: string | null;
}

const ENCABEZADOS = [
  "Fecha llamada",
  "Lead",
  "Correo",
  "Closer",
  "Resultado",
  "Etapa del deal",
  "Link Grain",
  "Link CRM",
] as const;

function celdaCsv(valor: string | null): string {
  let texto = valor ?? "";
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
}

/** CSV para Excel: UTF-8 con BOM, CRLF y todas las celdas citadas. */
export function csvDeGrain(filas: readonly FilaCsvGrain[]): string {
  const lineas = [
    ENCABEZADOS.map(celdaCsv).join(","),
    ...filas.map((fila) =>
      [
        fila.fechaLlamada,
        fila.lead,
        fila.correo,
        fila.closer,
        fila.resultado,
        fila.etapaDeal,
        fila.linkGrain,
        fila.linkCrm,
      ]
        .map(celdaCsv)
        .join(","),
    ),
  ];
  return `\uFEFF${lineas.join("\r\n")}`;
}
