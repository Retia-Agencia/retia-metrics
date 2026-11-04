import { redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programasVisibles } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { rutaDePrograma } from "@/lib/nav";
import { elegirPrograma } from "@/lib/programa-preferido";
import { programaPreferidoDeCookie } from "@/lib/programa-preferido-servidor";

/** Recursos es una tab del programa: la URL vieja abre la del programa elegido. */
export default async function RecursosPage() {
  const session = await paginaConRol("gerente", "closer");
  const visibles = await programasVisibles(session.user.id, await rolDeVista(session), db);
  const programa = elegirPrograma(visibles, await programaPreferidoDeCookie());
  redirect(programa ? rutaDePrograma(programa.slug, "recursos") : "/");
}
