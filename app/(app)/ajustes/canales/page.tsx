import { notFound, redirect } from "next/navigation";
import { programasVisibles } from "@/lib/auth/alcance";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { rutaDePrograma } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Canales se retiró (ADR 0087): su pantalla es Hub › Origen. Redirige al Hub del primer programa visible,
 * no al de "todos": ese solo abre quien administra (ADR 0082) y el paid trafficker, dueño de Origen (ADR 0052),
 * recibiría 404. Misma guarda que Origen: `manejaPauta`.
 */
export default async function CanalesPage() {
  const session = await paginaConCapacidad(manejaPauta);
  const rol = await rolDeVista(session);
  const [primero] = await programasVisibles(session.user.id, rol);
  if (!primero) notFound();
  redirect(`${rutaDePrograma(primero.slug, "hub")}?seccion=origen`);
}
