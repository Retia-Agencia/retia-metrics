import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, esRolValido, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { duenosPosibles } from "@/lib/deals/duenos";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { PageShell } from "@/components/page-shell";
import { InboxSinDueno } from "@/components/deals/inbox-sin-dueno";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ programa: string }> };

/**
 * El Inbox de un programa (ADR 0050, ticket 070): las dos listas por las que un deal SIN
 * dueño consigue uno —Agendados sin dueño (el caso urgente) y Pendiente Setteo—. Misma
 * guarda y mismo alcance que Deals: `paginaConRol("gerente", "closer")`, `rolDeVista` y
 * `programaVisiblePorSlug` -> `notFound()`. El developer pasa por `esAccesoTotal`; nunca se
 * compara el rol a mano.
 *
 * Un programa que la sesión no ve responde 404, igual que un slug inexistente (ADR 0048).
 *
 * Lo que se muestra como botón es proyección: `trabajaLeads` ve "Reclamar" y `esAdministrador`
 * ve "Reasignar". La reja de verdad está en las server actions y en `lib/deals/`, que
 * rechazan igual una petición forjada.
 */
export default async function InboxDelProgramaPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa || !esRolValido(rol)) notFound();

  const [secciones, duenos] = await Promise.all([
    seccionesSinDueno(db, programa.id),
    duenosPosibles(db, programa.id),
  ]);

  return (
    <PageShell titulo={programa.nombre} descripcion="Inbox · sin dueño">
      <InboxSinDueno
        pendienteSetteo={secciones.pendienteSetteo}
        unclaimed={secciones.unclaimed}
        puedeReclamar={trabajaLeads(rol)}
        administra={esAdministrador(rol)}
        duenos={duenos}
      />
    </PageShell>
  );
}
