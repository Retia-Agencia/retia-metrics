import { redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { queryHaciaElHub, RUTA_HUB_TODOS } from "@/lib/nav";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** La lista de una cifra de todos los programas pasó al Hub (ticket 250): redirige con la misma guarda. */
export default async function ListaDeTodosViejaPage({ searchParams }: Props) {
  await paginaConRol("gerente", "closer");
  redirect(`${RUTA_HUB_TODOS}/lista${queryHaciaElHub(await searchParams)}`);
}
