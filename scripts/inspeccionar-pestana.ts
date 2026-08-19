import "./load-env";
import { google } from "googleapis";
import { clienteGoogle } from "../lib/sheets/auth";

/**
 * Inspecciona pestanas: encabezados, filas con datos y rango de fechas.
 * NO imprime datos personales — solo estructura y conteos.
 * Uso: tsx scripts/inspeccionar-pestana.ts <spreadsheetId> "<pestana>" [...]
 */

const CAMPOS_SENSIBLES = /correo|email|tel|celu|phone|nombre|name|whatsapp|documento|cedula/i;

async function main() {
  const [id, ...pestanas] = process.argv.slice(2);
  if (!id || pestanas.length === 0) {
    console.error('Uso: tsx scripts/inspeccionar-pestana.ts <id> "<pestana>" [...]');
    process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth: clienteGoogle() });

  for (const pestana of pestanas) {
    console.log("\n" + "═".repeat(76));
    console.log(`  ${pestana}`);
    console.log("═".repeat(76));

    let valores: string[][];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: `'${pestana}'!A1:AZ`,
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
      });
      valores = (res.data.values ?? []) as string[][];
    } catch (e: unknown) {
      console.log(`  No se pudo leer: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    if (valores.length === 0) { console.log("  Vacia."); continue; }

    const encabezados = (valores[0] ?? []).map((h) => String(h ?? "").trim());
    const filas = valores.slice(1).filter((f) => f.some((c) => String(c ?? "").trim() !== ""));

    console.log(`  Filas con datos: ${filas.length}   |   Columnas: ${encabezados.length}\n`);
    console.log("  Encabezados:");
    encabezados.forEach((h, i) => {
      if (!h) return;
      const col = String.fromCharCode(65 + (i % 26));
      const pref = i >= 26 ? "A" + col : col;
      const marca = CAMPOS_SENSIBLES.test(h) ? "  [dato personal]" : "";
      console.log(`    ${pref.padEnd(3)} ${h}${marca}`);
    });

    // Rango de fechas: primera columna que parezca marca temporal
    const iFecha = encabezados.findIndex((h) => /fecha|timestamp|marca temporal|date/i.test(h));
    if (iFecha >= 0 && filas.length > 0) {
      const fechas = filas.map((f) => String(f[iFecha] ?? "").trim()).filter(Boolean);
      if (fechas.length) {
        console.log(`\n  Columna de fecha: "${encabezados[iFecha]}"`);
        console.log(`    primera entrada : ${fechas[0]}`);
        console.log(`    ultima entrada  : ${fechas[fechas.length - 1]}`);
        console.log(`    con fecha       : ${fechas.length} de ${filas.length} filas`);
      }
    }
  }
  console.log("");
}

main().catch((e) => { console.error("Fallo:", e instanceof Error ? e.message : e); process.exit(1); });
