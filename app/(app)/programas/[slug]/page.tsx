import { redirect } from "next/navigation";
import { rutaDePrograma } from "@/lib/nav";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * La ruta vieja del dashboard (ticket 005). Desde el ticket 097 el programa es un
 * segmento, `/p/<programa>/dashboard` (ADR 0050): aqui solo se redirige, con el filtro
 * de la URL intacto, para que un link guardado siga abriendo lo mismo. No valida el
 * programa: lo hace la ruta nueva, y un slug ajeno da el mismo 404 alla que aqui.
 */
export default async function ProgramaViejoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [llave, valor] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) {
      query.append(llave, v);
    }
  }
  const resto = query.toString();
  redirect(`${rutaDePrograma(slug, "dashboard")}${resto ? `?${resto}` : ""}`);
}
