import { redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { rutaDePrograma } from "@/lib/nav";
import { elegirPrograma } from "@/lib/programa-preferido";
import { programaPreferidoDeCookie } from "@/lib/programa-preferido-servidor";
import { cargarDatosDeRedireccionARecursos } from "@/lib/recursos/redireccion/cargar-datos";

/** Recursos es una tab del programa: la URL vieja abre la del programa elegido. */
export default async function RecursosPage() {
  const session = await paginaConRol("gerente", "closer");
  const visibles = await cargarDatosDeRedireccionARecursos(db, { userId: session.user.id, rol: await rolDeVista(session) });
  const programa = elegirPrograma(visibles, await programaPreferidoDeCookie());
  redirect(programa ? rutaDePrograma(programa.slug, "recursos") : "/");
}
