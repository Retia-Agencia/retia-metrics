import { db } from "@/lib/db";
import { revocarValorOauth } from "@/lib/oauth/emision";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    const token = new URLSearchParams(await request.text()).get("token");
    if (token) await revocarValorOauth(db, token);
  }
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}
