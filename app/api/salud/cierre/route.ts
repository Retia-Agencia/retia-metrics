import { respuestaCierreSchema } from "@/lib/alertas/contrato";
import { db } from "@/lib/db";
import { textoDeCierre } from "@/lib/salud/cierre";
import { secretoDeMaquinaValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!secretoDeMaquinaValido(request, { header: "x-alertas-secreto", variable: "ALERTAS_SECRETO" })) {
    return new Response(null, { status: 401 });
  }

  const ahora = new Date();
  const respuesta = respuestaCierreSchema.parse({
    generadoEn: ahora.toISOString(),
    texto: await textoDeCierre(db, ahora),
  });
  return Response.json(respuesta);
}
