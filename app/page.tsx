import { redirect } from "next/navigation";
import { paginaConSesion } from "@/lib/auth/page-guards";
import { rutaInicial } from "@/lib/nav";

export default async function Home() {
  const session = await paginaConSesion();
  redirect(rutaInicial(session.user.rol));
}
