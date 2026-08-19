import { google } from "googleapis";

/**
 * Cliente autenticado con la cuenta de servicio.
 * La llave viaja como JSON completo en base64 dentro de una sola variable de entorno,
 * porque los saltos de linea de la clave privada no sobreviven bien en las UIs de
 * variables de entorno (Vercel incluido).
 */
export function credencialesCuentaServicio() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!b64) {
    throw new Error(
      "Falta GOOGLE_SERVICE_ACCOUNT_JSON_B64. Corre: npm run cuenta-servicio",
    );
  }
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
    client_email: string;
    private_key: string;
    project_id: string;
  };
}

/** Solo lectura mientras no haya que escribir. La Fase 4 sube a scope de escritura. */
export const SCOPES_LECTURA = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export const SCOPES_ESCRITURA = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

export function clienteGoogle(scopes: string[] = SCOPES_LECTURA) {
  const cred = credencialesCuentaServicio();
  return new google.auth.JWT({
    email: cred.client_email,
    key: cred.private_key,
    scopes,
  });
}
