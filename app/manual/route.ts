import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireSession, respuestaDeError } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/** Sirve el manual comercial solamente a usuarios autenticados. */
export async function GET() {
  try {
    await requireSession();
    const manual = await readFile(
      path.join(process.cwd(), "docs/manuales/operacion-comercial.html"),
      "utf8",
    );
    const html =
      '<!doctype html>\n<html lang="es">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>\n' +
      manual +
      "\n</html>";

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
