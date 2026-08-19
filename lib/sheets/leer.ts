import { google } from "googleapis";
import { clienteGoogle } from "./auth";

/** Lee una pestana completa. El titulo va entre comillas simples: hay emojis en los nombres. */
export async function leerPestana(
  sheetId: string,
  tab: string,
  rango = "A1:BZ",
): Promise<string[][]> {
  const sheets = google.sheets({ version: "v4", auth: clienteGoogle() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!${rango}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values ?? []) as string[][];
}
