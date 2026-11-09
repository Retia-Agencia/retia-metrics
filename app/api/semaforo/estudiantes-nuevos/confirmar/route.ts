import { confirmarEstudiantesNuevos } from "@/lib/avisos-cs/pendientes";
import { esquemaConfirmarEstudiantesNuevos } from "@/lib/avisos-cs/contrato";
import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { normalizando } from "@/lib/errors-zod";
import { secretoDeSemaforoValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!secretoDeSemaforoValido(request)) return new Response(null, { status: 401 });
  try {
    const entrada = await normalizando(async () =>
      esquemaConfirmarEstudiantesNuevos.parse(await request.json().catch(() => null)),
    );
    const confirmadas = await confirmarEstudiantesNuevos(db, entrada.entregas);
    return Response.json({ confirmadas });
  } catch (error) {
    return respuestaDeError(error);
  }
}
