import { requireRole, respuestaDeError } from "@/lib/auth/guards";

export const runtime = "nodejs";

/**
 * Endpoint de referencia, solo gerente.
 * Existe para probar la barrera de roles de punta a punta (ver tests/guards.test.ts).
 * Las fases siguientes copian este patron: try / requireRole / catch respuestaDeError.
 */
export async function GET() {
  try {
    const session = await requireRole("gerente");
    return Response.json({ ok: true, gerente: session.user.email });
  } catch (error) {
    return respuestaDeError(error);
  }
}
