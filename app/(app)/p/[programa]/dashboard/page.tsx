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
 * El Dashboard pasó a ser el Hub (ADR 0086, ticket 250). Esta ruta solo redirige, con los
 * filtros y la pestaña traducida, y conserva su GUARDA para no filtrar a quién redirige. Se
 * quita en la fecha anotada en `docs/operations.md`.
 */
export default async function DashboardViejoPage({ params, searchParams }: Props) {
  await paginaConCapacidad(veTableroDelPrograma);
  const { programa } = await params;
  redirect(`${rutaDePrograma(programa, "hub")}${queryHaciaElHub(await searchParams)}`);
}
