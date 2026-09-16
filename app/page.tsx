import { redirect } from "next/navigation";
import { paginaConSesion, destinoInicial } from "@/lib/auth/page-guards";

export default async function Home() {
  const session = await paginaConSesion();
  redirect(await destinoInicial(session.user.rol));
}
