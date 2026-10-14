import { redirect } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { queryHaciaElHub, rutaDePrograma } from "@/lib/nav";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** La lista de una cifra pasó al Hub (ticket 250): redirige con la misma guarda y la misma query. */
export default async function ListaViejaPage({ params, searchParams }: Props) {
  await paginaConCapacidad(esAdministrador);
  const { programa } = await params;
  redirect(`${rutaDePrograma(programa, "hub")}/lista${queryHaciaElHub(await searchParams)}`);
}
