import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { requireRole, respuestaDeError } from "@/lib/auth/guards";
import { exigirMismoOrigen } from "@/lib/auth/origen";
import { sincronizarPersonas } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Patron de validacion del proyecto: un esquema por ruta, parseado en el borde del
 * handler, y el error traducido a 400 por respuestaDeError.
 *
 * Hoy el unico parametro es un slug que va a un `eq()` parametrizado de Drizzle, asi
 * que esto no tapa ninguna inyeccion. Se fija ahora, con el endpoint que ya existe,
 * porque la Fase 4 recibe el formulario de registro de llamadas (un POST con cuerpo)
 * y la Fase 5 recibe archivos subidos: es mas barato que cada una invente su forma.
 */
const paramsSchema = z.object({
  programa: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "El programa debe ser un slug: minusculas, numeros y guiones."),
});

/** Dispara la sincronizacion de un programa. Solo gerente. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ programa: string }> },
) {
  try {
    // Antes que nada: es el unico handler que muta sin pasar por el chequeo de
    // origen que Next hace solo en las Server Actions (S-12). Ver lib/auth/origen.ts.
    exigirMismoOrigen(req);
    await requireRole("gerente");
    const { programa } = paramsSchema.parse(await params);

    const [p] = await db.select().from(programs).where(eq(programs.slug, programa)).limit(1);
    if (!p) return Response.json({ error: `No existe el programa "${programa}".` }, { status: 404 });

    const resultado = await sincronizarPersonas(p.id);
    return Response.json({ ok: true, resultado });
  } catch (error) {
    // Todo pasa por respuestaDeError. MapeoInvalidoError ya sabe que es un 422;
    // cualquier otra excepcion sale como "Error interno." y se registra aca.
    return respuestaDeError(error);
  }
}
