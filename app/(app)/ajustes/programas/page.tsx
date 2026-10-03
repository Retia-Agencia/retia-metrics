import { redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programasInactivosParaAdministrar, programasVisibles } from "@/lib/auth/alcance";

export const dynamic = "force-dynamic";

export default async function ProgramasPage() {
  const session = await paginaConRol("gerente");
  const rol = await rolDeVista(session);
  const activos = await programasVisibles(session.user.id, rol);
  if (activos[0]) redirect(`/p/${activos[0].slug}/programa`);
  const inactivos = await programasInactivosParaAdministrar(rol);
  redirect(inactivos[0] ? `/p/${inactivos[0].slug}/programa` : "/");
}
