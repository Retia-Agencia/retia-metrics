import { redirect } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { veTableroDelPrograma } from "@/lib/auth/roles";
import { queryHaciaElHub, rutaDePrograma } from "@/lib/nav";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Metas vive ahora en la pestaña Hoy del Hub (ADR 0086 punto 1, ticket 250). Redirige con el
 * mes y la misma guarda que tenía.
 */
export default async function MetasViejaPage({ params, searchParams }: Props) {
  await paginaConCapacidad(veTableroDelPrograma);
  const { programa } = await params;
  redirect(`${rutaDePrograma(programa, "hub")}${queryHaciaElHub(await searchParams, "hoy")}#metas`);
}
