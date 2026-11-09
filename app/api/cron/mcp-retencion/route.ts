import { db } from "@/lib/db";
import { purgarLlamadasAntiguas } from "@/lib/mcp/bitacora";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  return Response.json({ borradas: await purgarLlamadasAntiguas(db) });
}
