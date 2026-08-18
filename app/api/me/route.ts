import { requireSession, respuestaDeError } from "@/lib/auth/guards";

export const runtime = "nodejs";

/** Endpoint abierto a cualquier usuario autenticado. Devuelve solo lo suyo. */
export async function GET() {
  try {
    const session = await requireSession();
    return Response.json({
      id: session.user.id,
      nombre: session.user.name,
      rol: session.user.rol,
      closerId: session.user.closerId,
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
