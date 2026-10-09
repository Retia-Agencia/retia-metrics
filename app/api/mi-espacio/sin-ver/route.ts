import { z } from "zod";
import { requireSession, respuestaDeError } from "@/lib/auth/guards";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { trabajaLeads } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { conteoSinVer } from "@/lib/mi-espacio/notificaciones";

export const runtime = "nodejs";

const esquema = z.object({
  programa: z.string().min(1, "Programa inválido."),
});

/**
 * El "número sin ver" de Mi espacio (ticket 223): cuántos deals del closer en el programa
 * elegido tienen algo nuevo sin ver. El layout no se re-renderiza en navegación del cliente,
 * así que el circulito del menú lo pide por aquí y lo refresca cuando algo cambia.
 *
 * Sin datos personales en la URL: solo el slug del programa. Un programa que la sesión no ve
 * responde 404 (igual que un slug inexistente, ADR 0048), nunca filtra que existe. Un rol que
 * no trabaja leads no tiene Mi espacio: responde `{ total: 0 }` en vez de un error.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { programa: slug } = esquema.parse({ programa: searchParams.get("programa") ?? undefined });

    const session = await requireSession();
    const rol = await rolDeVista(session);
    if (!trabajaLeads(rol)) return Response.json({ total: 0 });

    const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
    if (!programa) throw new ErrorDeApp("No encontrado.", 404);

    const total = await conteoSinVer(db, { programId: programa.id, userId: session.user.id });
    return Response.json({ total });
  } catch (error) {
    return respuestaDeError(error);
  }
}
