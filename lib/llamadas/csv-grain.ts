export interface FilaCsvGrain {
  fechaLlamada: string | null;
  fechaAgendada: string | null;
  lead: string | null;
  correo: string | null;
  closer: string | null;
  resultado: string | null;
  etapaDeal: string | null;
  cohorte: string | null;
  linkGrain: string | null;
  linkCrm: string | null;
}

const ENCABEZADOS = [
  "Fecha llamada",
  "Fecha agendada",
  "Lead",
  "Correo",
  "Closer",
  "Resultado",
  "Etapa del deal",
  "Cohorte",
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
        fila.fechaAgendada,
        fila.lead,
        fila.correo,
        fila.closer,
        fila.resultado,
        fila.etapaDeal,
        fila.cohorte,
        fila.linkGrain,
        fila.linkCrm,
      ]
        .map(celdaCsv)
        .join(","),
    ),
  ];
  return `\uFEFF${lineas.join("\r\n")}`;
}
