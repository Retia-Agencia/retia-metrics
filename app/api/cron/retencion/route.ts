import { db } from "@/lib/db";
import { respuestaDeError } from "@/lib/auth/guards";
import { aplicarRetencion } from "@/lib/retencion/retencion";

export const runtime = "nodejs";

/** Retencion diaria de sobres, entregas y notificaciones (ADR 0127, ticket 402). */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    return Response.json(await aplicarRetencion(db));
  } catch (e) {
    return respuestaDeError(e);
  }
}
