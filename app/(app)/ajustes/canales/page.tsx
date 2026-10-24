import { redirect } from "next/navigation";
import { paginaConPautaGlobal } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

/** El catálogo queda en la base, pero su pantalla fue reemplazada por Hub › Origen. */
export default async function CanalesPage() {
  await paginaConPautaGlobal();
  redirect("/hub?seccion=origen");
}
