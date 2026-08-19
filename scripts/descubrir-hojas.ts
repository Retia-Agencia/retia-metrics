import "./load-env";
import { google } from "googleapis";
import { clienteGoogle, credencialesCuentaServicio } from "../lib/sheets/auth";

/**
 * Lista las hojas de calculo compartidas con la cuenta de servicio y sus pestanas.
 * Sirve para sacar los IDs y los nombres exactos de tab sin copiarlos a mano,
 * y de paso comprueba que el acceso quedo bien configurado.
 */
async function main() {
  const cred = credencialesCuentaServicio();
  console.log(`\nCuenta de servicio: ${cred.client_email}\n`);

  const auth = clienteGoogle();
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: "files(id,name,owners(emailAddress),modifiedTime)",
    pageSize: 50,
  });

  const archivos = res.data.files ?? [];
  if (archivos.length === 0) {
    console.log("No hay ninguna hoja compartida con esta cuenta todavia.");
    console.log("Comparte las BBDD con el correo de arriba, como Editor.\n");
    return;
  }

  console.log(`${archivos.length} hoja(s) accesible(s):\n`);

  for (const f of archivos) {
    console.log("═".repeat(78));
    console.log(`  ${f.name}`);
    console.log(`  ID: ${f.id}`);
    console.log(`  Modificada: ${f.modifiedTime}`);
    console.log("─".repeat(78));

    try {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: f.id!,
        fields: "sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))",
      });
      const tabs = meta.data.sheets ?? [];
      console.log(`  ${tabs.length} pestana(s):\n`);
      for (const t of tabs) {
        const p = t.properties!;
        const g = p.gridProperties!;
        console.log(
          `    · ${String(p.title).padEnd(34)} ${String(g.rowCount).padStart(6)} filas x ${String(g.columnCount).padStart(3)} col`,
        );
      }
    } catch (e: any) {
      console.log(`  No se pudo leer la estructura: ${e?.message ?? e}`);
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error("\nFallo:", e?.message ?? e);
  process.exit(1);
});
