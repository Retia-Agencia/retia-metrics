import { eq } from "drizzle-orm";
import { respuestaDeError } from "@/lib/auth/guards";
import { reconciliarCalendly } from "@/lib/calendly/reconciliar";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Red diaria para cerrar carreras entre el formulario y Calendly (ticket 363). */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const activos = await db.select({ id: programs.id }).from(programs).where(eq(programs.activo, true));
    const programas = [];
    for (const programa of activos) {
      programas.push({ programId: programa.id, ...(await reconciliarCalendly(db, programa.id)) });
    }
    return Response.json({ programas });
  } catch (error) {
    return respuestaDeError(error);
  }
}
