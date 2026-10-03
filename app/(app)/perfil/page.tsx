import { redirect } from "next/navigation";
import { paginaConSesion } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

/**
 * `/perfil` se fusionó en **Mi espacio** (ticket 172): el perfil (nombre, foto, rol y
 * Calendly por programa) vive ahora arriba de `/mi-espacio`, y `closer_id` ya no se
 * muestra (167, 159). Esta ruta solo redirige, conservando su guarda de sesión.
 */
export default async function PerfilPage() {
  await paginaConSesion();
  redirect("/mi-espacio");
}
