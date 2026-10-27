import { z } from "zod";
import { db } from "@/lib/db";
import { clasificarCampanas } from "@/lib/pauta/proposito";
import { secretoDeSemaforoValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

const esquema = z.object({
  texto: z.string(),
  destino: z.string().nullable(),
  autor: z.object({
    nombre: z.string().nullable(),
    telefono: z.string().nullable(),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  if (!secretoDeSemaforoValido(request)) return new Response(null, { status: 401 });
  const entrada = esquema.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  const texto = await clasificarCampanas(db, entrada.data);
  return Response.json({ texto });
}
