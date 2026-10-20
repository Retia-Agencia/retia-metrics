import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enviarEventosPendientes } from "@/lib/meta-capi/enviar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    return Response.json(await enviarEventosPendientes(db, fetch, new Date()));
  } catch (error) {
    return respuestaDeError(error);
  }
}
