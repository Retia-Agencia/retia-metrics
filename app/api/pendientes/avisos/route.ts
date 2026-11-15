import { respuestaDeError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { normalizando } from "@/lib/errors-zod";
import { avisosPendientesDeClosers } from "@/lib/pendientes-de-closer/armar";
import { esquemaPedirAvisosPendientes, esquemaRespuestaAvisosPendientes } from "@/lib/pendientes-de-closer/contrato";
import { secretoDeMaquinaValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!secretoDeMaquinaValido(request, { header: "x-semaforo-secreto", variable: "SEMAFORO_SECRETO" })) {
    return new Response(null, { status: 401 });
  }
  try {
    const entrada = await normalizando(async () =>
      esquemaPedirAvisosPendientes.parse(await request.json().catch(() => null)),
    );
    const respuesta = await avisosPendientesDeClosers(db, {
      ventana: entrada.ventana,
      origen: new URL(request.url).origin,
    });
    return Response.json(esquemaRespuestaAvisosPendientes.parse(respuesta));
  } catch (error) {
    return respuestaDeError(error);
  }
}
export const maxDuration = 60;
