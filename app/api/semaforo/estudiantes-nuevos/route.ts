import { estudiantesNuevosPendientes } from "@/lib/avisos-cs/pendientes";
import { esquemaRespuestaEstudiantesNuevos } from "@/lib/avisos-cs/contrato";
import { db } from "@/lib/db";
import { secretoDeSemaforoValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!secretoDeSemaforoValido(request)) return new Response(null, { status: 401 });
  const respuesta = await estudiantesNuevosPendientes(db, {
    origen: new URL(request.url).origin,
  });
  return Response.json(esquemaRespuestaEstudiantesNuevos.parse(respuesta));
}
