import { redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

/**
 * `/mi-dia` se fusionó en **Mi espacio** (ticket 172): todo lo del usuario vive ahora en
 * `/mi-espacio`. Esta ruta solo redirige, conservando su GUARDA —sigue siendo de quien
 * trabaja leads (closer y developer, ADR 0003/0025)— para no filtrar a quién redirige.
 */
export default async function MiDiaPage() {
  await paginaConRol("closer");
  redirect("/mi-espacio");
}
