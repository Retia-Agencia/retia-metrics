import { redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programasInactivosParaAdministrar, programasVisibles } from "@/lib/auth/alcance";

export const dynamic = "force-dynamic";

export default async function FuentesPage() {
  const session = await paginaConRol("gerente");
  const rol = await rolDeVista(session);
  const activos = await programasVisibles(session.user.id, rol);
  const primero = activos[0] ?? (await programasInactivosParaAdministrar(rol))[0];
  redirect(primero ? `/p/${primero.slug}/programa#formularios` : "/");
}
