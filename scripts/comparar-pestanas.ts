import "./load-env";
import { google } from "googleapis";
import { clienteGoogle } from "../lib/sheets/auth";

/**
 * Compara dos pestanas por solapamiento de correos, para decidir si son
 * fuentes distintas o una es subconjunto de la otra.
 * NO imprime correos ni datos personales — solo conteos y fechas.
 *
 * Uso: tsx scripts/comparar-pestanas.ts <spreadsheetId> "<pestana A>" "<pestana B>"
 */
async function main() {
  const [id, a, b] = process.argv.slice(2);
  if (!id || !a || !b) {
    console.error('Uso: tsx scripts/comparar-pestanas.ts <id> "<pestana A>" "<pestana B>"');
    process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth: clienteGoogle() });

  async function leer(pestana: string) {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: "'" + pestana + "'!A1:BZ",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const v = (r.data.values ?? []) as string[][];
    const head = (v[0] ?? []).map((h) => String(h ?? "").trim());
    const iMail = head.findIndex((h) => /correo|e-?mail/i.test(h));
    const iFecha = head.findIndex((h) => /submitted at|marca temporal|timestamp|fecha/i.test(h));
    const filas = v.slice(1).filter((f) => f.some((c) => String(c ?? "").trim() !== ""));
    return {
      nombre: pestana,
      total: filas.length,
      correos: iMail < 0 ? [] : filas.map((f) => String(f[iMail] ?? "").toLowerCase().trim()).filter(Boolean),
      fechas: iFecha < 0 ? [] : filas.map((f) => String(f[iFecha] ?? "").trim()).filter(Boolean),
    };
  }

  const A = await leer(a);
  const B = await leer(b);

  for (const t of [A, B]) {
    const u = new Set(t.correos);
    console.log("\n" + t.nombre);
    console.log("  filas con datos : " + t.total);
    console.log("  con correo      : " + t.correos.length);
    console.log("  personas unicas : " + u.size + "   (duplicados: " + (t.correos.length - u.size) + ")");
    if (t.fechas.length) {
      console.log("  primera entrada : " + t.fechas[0]);
      console.log("  ultima entrada  : " + t.fechas[t.fechas.length - 1]);
    }
  }

  const setA = new Set(A.correos);
  const unicosB = [...new Set(B.correos)];
  const enAmbas = unicosB.filter((c) => setA.has(c));
  const soloB = unicosB.filter((c) => !setA.has(c));

  console.log("\n" + "-".repeat(64));
  console.log("  De las " + unicosB.length + " personas de '" + B.nombre + "':");
  console.log("    ya estan en '" + A.nombre + "' : " + enAmbas.length);
  console.log("    NO estan en '" + A.nombre + "' : " + soloB.length);
  console.log("-".repeat(64));
  console.log("  Solo '" + A.nombre + "', deduplicado : " + setA.size + " personas");
  console.log("  Union de ambas, deduplicada    : " + new Set([...A.correos, ...B.correos]).size + " personas");
  console.log("");
}

main().catch((e) => { console.error("Fallo:", e?.message ?? e); process.exit(1); });
