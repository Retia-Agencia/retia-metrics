import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sincronizarPersonas } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Comparacion que no corta en el primer byte distinto. Por red es poco practico de
 * explotar, asi que esto es endurecimiento y no el cierre de un agujero.
 */
function secretoValido(enviado: string | null, esperado: string): boolean {
  if (!enviado) return false;
  const a = Buffer.from(enviado);
  const b = Buffer.from(`Bearer ${esperado}`);
  // timingSafeEqual exige la misma longitud. Comparar largos primero delata el
  // largo del secreto y nada mas, que no sirve para adivinarlo.
  return a.length === b.length && timingSafeEqual(a, b);
}

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

  if (!secretoValido(req.headers.get("authorization"), esperado)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const activos = await db.select().from(programs).where(eq(programs.activo, true));
  let sincronizados = 0;
  let fallidos = 0;

  for (const p of activos) {
    try {
      await sincronizarPersonas(p.id);
      sincronizados++;
    } catch (e) {
      // Un programa que falla no debe impedir que el otro se sincronice.
      fallidos++;
      console.error(`[cron] fallo la sincronizacion de ${p.slug}`, e);
    }
  }

  // Solo conteos. Esta ruta esta en la lista de publicas de proxy.ts porque el cron
  // no tiene sesion, y el mensaje de un MapeoInvalidoError imprime los encabezados
  // reales de la hoja, o sea las preguntas del formulario. El detalle queda en
  // sync_runs.errores, que existe justamente para eso.
  return Response.json({ ok: fallidos === 0, programas: activos.length, sincronizados, fallidos });
}
