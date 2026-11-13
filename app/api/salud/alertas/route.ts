import { alertasActivas } from "@/lib/alertas/registro";
import { respuestaAlertasSchema } from "@/lib/alertas/contrato";
import { db } from "@/lib/db";
import { secretoDeMaquinaValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!secretoDeMaquinaValido(request, { header: "x-alertas-secreto", variable: "ALERTAS_SECRETO" })) {
    return new Response(null, { status: 401 });
  }

  const ahora = new Date();
  const respuesta = respuestaAlertasSchema.parse({
    generadoEn: ahora.toISOString(),
    alertas: await alertasActivas(db, ahora),
  });
  return Response.json(respuesta);
}
