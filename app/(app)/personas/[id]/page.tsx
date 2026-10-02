import { notFound, redirect } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { slugDelLeadVisible } from "@/lib/queries/ficha-lead";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Forma de un UUID v4 tal como lo genera la base. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/personas/[id]` ya no tiene pantalla propia (ticket 073): la ficha del Lead vive dentro de su
 * programa, en `/p/<programa>/leads/<id>`, y esta ruta solo redirige ahi para que los enlaces
 * viejos (el buscador de Personas, la migracion, las entregas del webhook) sigan llevando al
 * mismo lead.
 *
 * La guarda corre ANTES de mirar el id (sin sesion, al login sin filtrar que ids existen). Un id
 * con otra forma, inexistente o de un programa que la sesion no ve es 404, igual en los tres
 * casos (ADR 0048): la redireccion nunca revela el programa de un lead ajeno.
 */
export default async function PersonaPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // El rol de vista, no `session.user.rol` crudo (ADR 0028).
  const slug = await slugDelLeadVisible(id, session.user.id, await rolDeVista(session), db);
  if (!slug) notFound();

  redirect(`/p/${slug}/leads/${id}`);
}
