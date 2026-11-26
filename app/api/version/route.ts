import { requireSession, respuestaDeError } from "@/lib/auth/guards";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    return Response.json(
      { deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return respuestaDeError(error);
  }
}
