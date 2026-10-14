import { almacenDeArchivos } from "@/lib/archivos";
import { crearEspejoDrive } from "@/lib/archivos/espejo-drive";
import { respaldarComprobantes } from "@/lib/archivos/respaldo";
import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const raizId = process.env.DRIVE_COMPROBANTES_ID || null;
    const espejo = raizId ? crearEspejoDrive(raizId) : null;
    const resumen = await respaldarComprobantes(
      db,
      almacenDeArchivos(),
      espejo,
      raizId,
      new Date(),
    );
    return Response.json(resumen);
  } catch (error) {
    return respuestaDeError(error);
  }
}
