import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { leerForm30x } from "@/lib/ingesta/leer-form30x";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    return Response.json(await leerForm30x(db));
  } catch (error) {
    return respuestaDeError(error);
  }
}
