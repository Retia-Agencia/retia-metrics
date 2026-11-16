import { respuestaDeError } from "@/lib/auth/guards";
import { tokensMeta } from "@/lib/integraciones";
import { db } from "@/lib/db";
import { hoyEnBogota } from "@/lib/format";
import { sincronizarPauta } from "@/lib/pauta/sincronizar";
import { cuadrarPauta } from "@/lib/pauta/cuadre";
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
    const tokens = await tokensMeta(db);
    const resumen = await sincronizarPauta(db, {
      tokens,
      hoy,
      disparadaPor: "cron",
    });
    // El cuadre corre aunque la sincronización falle: ese es justo el día en que el descuadre debe avisarse.
    let cuadre: Awaited<ReturnType<typeof cuadrarPauta>> | { error: string };
    try {
      cuadre = await cuadrarPauta(db, { tokens, hoy });
    } catch (error) {
      console.error("cron pauta: el cuadre no se pudo ejecutar", error);
      cuadre = { error: "No se pudo ejecutar el cuadre de pauta." };
    }
    return Response.json({ ...resumen, trm, cuadre });
  } catch (error) {
    return respuestaDeError(error);
  }
}
export const maxDuration = 300;
