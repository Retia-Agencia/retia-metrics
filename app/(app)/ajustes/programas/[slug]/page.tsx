import { notFound, redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaDeLaFichaPorSlug } from "@/lib/auth/alcance";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProgramaAnteriorPage({ params }: Props) {
  const session = await paginaConRol("gerente");
  const { slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaDeLaFichaPorSlug(session.user.id, rol, slug);
  if (!programa) notFound();
  redirect(`/p/${programa.slug}/programa`);
}
