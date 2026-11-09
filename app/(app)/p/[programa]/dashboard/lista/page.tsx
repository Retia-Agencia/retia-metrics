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
 * La lista de una cifra pasó al Hub (ticket 250): redirige con la misma query. La guarda es la del tablero, la
 * más ancha de `hub/lista`; la capacidad de cada métrica (comercial o pauta) la aplica el destino (361, K-12).
 */
export default async function ListaViejaPage({ params, searchParams }: Props) {
  await paginaConCapacidad(veTableroDelPrograma);
  const { programa } = await params;
  redirect(`${rutaDePrograma(programa, "hub")}/lista${queryHaciaElHub(await searchParams)}`);
}
