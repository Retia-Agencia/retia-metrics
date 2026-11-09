import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hoyEnBogota } from "@/lib/format";
import { programasActivos } from "@/lib/queries/programas";
import { confirmarProyecciones, guardarProyeccionDelDia } from "@/lib/queries/proyeccion-roas";

export const runtime = "nodejs";

/**
 * Guarda la proyección diaria del ROAS de cada programa activo y confirma las anteriores cuyas citas ya
 * tienen resultado (ticket 375). Corre 30 minutos después del cron de pauta, para que el gasto del día esté
 * cargado. Un programa que falla no frena a los demás.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const hoy = hoyEnBogota();
    const ahora = new Date();
    const resumen: { slug: string; guardada: boolean; confirmadas: number; error?: string }[] = [];
    for (const programa of await programasActivos(db)) {
      try {
        const confirmadas = await confirmarProyecciones(db, programa.id, hoy, ahora);
        const guardada = await guardarProyeccionDelDia(db, programa.id, hoy, ahora);
        resumen.push({ slug: programa.slug, guardada, confirmadas });
      } catch (error) {
        console.error(`cron proyeccion-roas: fallo en ${programa.slug}`, error);
        resumen.push({ slug: programa.slug, guardada: false, confirmadas: 0, error: "No se pudo calcular." });
      }
    }
    return Response.json({ dia: hoy, programas: resumen });
  } catch (error) {
    return respuestaDeError(error);
  }
}
