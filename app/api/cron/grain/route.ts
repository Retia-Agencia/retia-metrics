import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { correrLecturasPendientes } from "@/lib/grain/transcripciones";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Cron diario de Grain (ADR 0112 punto 2, ticket 328): reintenta las llamadas con link y sin transcript. */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    return Response.json(await correrLecturasPendientes(db));
  } catch (error) {
    return respuestaDeError(error);
  }
}
