import { createHash } from "node:crypto";
import { ErrorDeApp } from "@/lib/errors";
import type { Db } from "@/lib/db/tipos";
import { credencialesMetaCapi, registrarPruebaMetaCapi } from "@/lib/integraciones";

export async function mandarPruebaMetaCapi(
  db: Db,
  actorId: string,
  programId: string,
  testEventCode: string,
  f: typeof fetch = fetch,
): Promise<void> {
  const codigo = testEventCode.trim();
  if (!codigo) throw new ErrorDeApp("El código del evento de prueba es obligatorio.", 422);
  const credenciales = await credencialesMetaCapi(db, programId);
  if (!credenciales) throw new ErrorDeApp("Primero conecta Meta CAPI.", 422);
  const ahora = new Date();
  const respuesta = await f(`https://graph.facebook.com/v26.0/${credenciales.datasetId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "Purchase",
        event_id: `prueba-${crypto.randomUUID()}`,
        event_time: Math.floor(ahora.getTime() / 1000),
        action_source: "system_generated",
        custom_data: { value: 1, currency: "USD" },
        user_data: { em: [createHash("sha256").update("prueba@retia.co").digest("hex")] },
      }],
      test_event_code: codigo,
      access_token: credenciales.token,
    }),
  });
  if (!respuesta.ok) throw new ErrorDeApp("Meta rechazó el evento de prueba. Revisa el código e inténtalo de nuevo.", 422);
  await registrarPruebaMetaCapi(db, actorId, programId, ahora);
}
