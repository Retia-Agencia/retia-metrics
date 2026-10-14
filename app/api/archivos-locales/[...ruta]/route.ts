import { esUrlLocal } from "@/lib/db/es-local";
import { esFirmaLocalValida, esRutaLocalValida, escribirArchivoLocal, leerArchivoLocal } from "@/lib/archivos/disco";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ ruta: string[] }> };

function rutaYFirma(request: Request, partes: string[], metodo: "GET" | "PUT") {
  const ruta = partes.join("/");
  const url = new URL(request.url);
  const exp = Number(url.searchParams.get("exp"));
  const firma = url.searchParams.get("firma") ?? "";
  return { ruta, autorizada: esRutaLocalValida(ruta) && esFirmaLocalValida(metodo, ruta, exp, firma) };
}

function noDisponible(): Response | null {
  return esUrlLocal(process.env.DATABASE_URL ?? "") ? null : new Response(null, { status: 404 });
}

export async function PUT(request: Request, contexto: Contexto) {
  const ausente = noDisponible();
  if (ausente) return ausente;
  const { ruta: partes } = await contexto.params;
  const { ruta, autorizada } = rutaYFirma(request, partes, "PUT");
  if (!autorizada) return Response.json({ error: "La firma del archivo no es válida o expiró." }, { status: 403 });
  await escribirArchivoLocal(ruta, new Uint8Array(await request.arrayBuffer()));
  return new Response(null, { status: 204 });
}

export async function GET(request: Request, contexto: Contexto) {
  const ausente = noDisponible();
  if (ausente) return ausente;
  const { ruta: partes } = await contexto.params;
  const { ruta, autorizada } = rutaYFirma(request, partes, "GET");
  if (!autorizada) return Response.json({ error: "La firma del archivo no es válida o expiró." }, { status: 403 });
  const contenido = await leerArchivoLocal(ruta);
  if (!contenido) return new Response(null, { status: 404 });
  const tipo = ruta.endsWith(".pdf") ? "application/pdf" : ruta.endsWith(".png")
    ? "image/png" : ruta.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(contenido.buffer as ArrayBuffer, { headers: { "content-type": tipo, "cache-control": "private, no-store" } });
}
