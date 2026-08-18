export const runtime = "nodejs";

/** Sonda publica de despliegue. No expone ningun dato del negocio. */
export function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
