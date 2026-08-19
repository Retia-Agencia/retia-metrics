import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sincronizarPersonas } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Sincronizacion programada. La dispara Vercel Cron cada 15 minutos.
 *
 * Se autentica con CRON_SECRET, no con sesion de usuario: no hay nadie
 * conectado cuando corre. Vercel manda el secreto en Authorization.
 */
export async function GET(req: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    return Response.json({ error: "CRON_SECRET no esta configurado." }, { status: 500 });
  }

  const enviado = req.headers.get("authorization");
  if (enviado !== `Bearer ${esperado}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const activos = await db.select().from(programs).where(eq(programs.activo, true));
  const resultados = [];
  const fallos = [];

  for (const p of activos) {
    try {
      resultados.push(await sincronizarPersonas(p.id));
    } catch (e) {
      // Un programa que falla no debe impedir que el otro se sincronice.
      fallos.push({ programa: p.slug, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({ ok: fallos.length === 0, resultados, fallos });
}
