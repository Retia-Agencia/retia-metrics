import { z } from "zod";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { requireSession, respuestaDeError } from "@/lib/auth/guards";
import { veTableroDelPrograma } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota } from "@/lib/format";
import { csvDeCitasPauta } from "@/lib/pauta/csv-citas";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";

export const runtime = "nodejs";

const fechaBogota = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export async function GET(request: Request, { params }: { params: Promise<{ programa: string }> }) {
  try {
    const session = await requireSession();
    const rol = await rolDeVista(session);
    if (!veTableroDelPrograma(rol)) throw new ErrorDeApp("No autorizado.", 403);
    const { programa: slug } = await params;
    const programa = await programaVisiblePorSlug(session.user.id, rol, slug, db);
    if (!programa) throw new ErrorDeApp("No encontrado.", 404);
    const url = new URL(request.url);
    const rango = z.object({ desde: fechaBogota, hasta: fechaBogota }).parse({
      desde: url.searchParams.get("a_desde"), hasta: url.searchParams.get("a_hasta"),
    });
    const vista = await cargarRoasDePauta(db, programa.id, rango, hoyEnBogota());
    return new Response(csvDeCitasPauta(vista), { headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pauta-citas-${programa.slug}-${rango.desde}-${rango.hasta}.csv"`,
      "cache-control": "no-store",
    } });
  } catch (error) {
    return respuestaDeError(error);
  }
}
