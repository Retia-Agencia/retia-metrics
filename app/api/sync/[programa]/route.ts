import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { requireRole, respuestaDeError } from "@/lib/auth/guards";
import { sincronizarPersonas } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Dispara la sincronizacion de un programa. Solo gerente. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ programa: string }> },
) {
  try {
    await requireRole("gerente");
    const { programa } = await params;

    const [p] = await db.select().from(programs).where(eq(programs.slug, programa)).limit(1);
    if (!p) return Response.json({ error: `No existe el programa "${programa}".` }, { status: 404 });

    const resultado = await sincronizarPersonas(p.id);
    return Response.json({ ok: true, resultado });
  } catch (error) {
    if (error instanceof Error && !("status" in error)) {
      // Errores del sync (mapeo invalido, hoja inaccesible) se reportan tal cual:
      // el mensaje dice que columna falto y que encabezados venian.
      return Response.json({ error: error.message }, { status: 422 });
    }
    return respuestaDeError(error);
  }
}
