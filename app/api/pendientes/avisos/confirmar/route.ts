import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { normalizando } from "@/lib/errors-zod";
import { esquemaConfirmarAvisosPendientes } from "@/lib/pendientes-de-closer/contrato";
import { confirmarAvisosPendientes } from "@/lib/pendientes-de-closer/registrar";
import { secretoDeMaquinaValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!secretoDeMaquinaValido(request, { header: "x-semaforo-secreto", variable: "SEMAFORO_SECRETO" })) {
    return new Response(null, { status: 401 });
  }
  try {
    const entrada = await normalizando(async () =>
      esquemaConfirmarAvisosPendientes.parse(await request.json().catch(() => null)),
    );
    const confirmados = await confirmarAvisosPendientes(db, entrada.avisos);
    return Response.json({ confirmados });
  } catch (error) {
    return respuestaDeError(error);
  }
}
export const maxDuration = 60;
