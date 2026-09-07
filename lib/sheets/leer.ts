import { google } from "googleapis";
import { clienteGoogle } from "./auth";

/** Lee una pestana completa. El titulo va entre comillas simples: hay emojis en los nombres. */
export async function leerPestana(
  sheetId: string,
  tab: string,
  rango = "A1:BZ",
): Promise<string[][]> {
  const sheets = google.sheets({ version: "v4", auth: clienteGoogle() });
  // Sheets escapa un apostrofo literal dentro del nombre de hoja duplicandolo.
  // Hoy los nombres sembrados no tienen apostrofos, pero sources.tab viene de la
  // base y el plan de la Fase 1 pedia poder editar el mapeo desde la UI: el dia que
  // esa pantalla exista, esto pasa a ser entrada de usuario.
  const tabEscapada = tab.replace(/'/g, "''");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabEscapada}'!${rango}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values ?? []) as string[][];
}
