import { redirect } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { queryHaciaElHub, RUTA_HUB_TODOS } from "@/lib/nav";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** El Dashboard de todos los programas pasó a ser el Hub (ticket 250): redirige con la misma guarda. */
export default async function DashboardDeTodosViejoPage({ searchParams }: Props) {
  await paginaConCapacidad(esAdministrador);
  redirect(`${RUTA_HUB_TODOS}${queryHaciaElHub(await searchParams)}`);
}
