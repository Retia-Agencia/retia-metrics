import { respuestaDeError } from "@/lib/auth/guards";
import { tokenActivoMeta } from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { hoyEnBogota } from "@/lib/format";
import { sincronizarPauta } from "@/lib/pauta/sincronizar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const resumen = await sincronizarPauta(db, {
      token: await tokenActivoMeta(db),
      hoy: hoyEnBogota(),
      disparadaPor: "cron",
    });
    return Response.json(resumen);
  } catch (error) {
    return respuestaDeError(error);
  }
}
