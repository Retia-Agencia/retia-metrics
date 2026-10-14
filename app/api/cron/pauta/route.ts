import { respuestaDeError } from "@/lib/auth/guards";
import { tokenActivoMeta } from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { hoyEnBogota } from "@/lib/format";
import { sincronizarPauta } from "@/lib/pauta/sincronizar";
import { leerTrm } from "@/lib/trm/registrar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const hoy = hoyEnBogota();
  let trm: Awaited<ReturnType<typeof leerTrm>> | { error: string };
  try {
    trm = await leerTrm(db, { hoy });
  } catch (error) {
    console.error("cron pauta: la TRM no se pudo leer", error);
    trm = { error: "No se pudo actualizar la TRM." };
  }
  try {
    const resumen = await sincronizarPauta(db, {
      token: await tokenActivoMeta(db),
      hoy,
      disparadaPor: "cron",
    });
    return Response.json({ ...resumen, trm });
  } catch (error) {
    return respuestaDeError(error);
  }
}
