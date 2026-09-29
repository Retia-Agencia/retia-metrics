import { redirect } from "next/navigation";
import { rutaDePrograma } from "@/lib/nav";

type Props = { params: Promise<{ programa: string }> };

/** `/p/<programa>` a secas entra por la tab por defecto; la tab valida el programa. */
export default async function ProgramaPage({ params }: Props) {
  const { programa } = await params;
  redirect(rutaDePrograma(programa));
}
