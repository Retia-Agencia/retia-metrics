import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { ProgramasAdmin, type ProgramaVista } from "@/components/programas-admin";
import { listarProgramas } from "@/lib/catalogo/programas";

export const dynamic = "force-dynamic";

/**
 * Pantalla de administracion de programas (ticket 014, ADR 0012), solo gerente. El
 * guard corre primero: un closer nunca llega a leer la base.
 *
 * Los programas salen de la base (ningun literal en el codigo). Crear uno lo hace
 * aparecer en el sidebar sin desplegar; desactivarlo lo saca sin borrar sus datos.
 * Las cohortes de cada programa viven en `./[slug]`.
 */
export default async function ProgramasPage() {
  await paginaConRol("gerente");

  const programas = await listarProgramas(db);
  const vista: ProgramaVista[] = programas.map((p) => ({
    id: p.id,
    slug: String(p.slug),
    nombre: String(p.nombre),
    ticketUsd: String(p.ticketUsd),
    webUrl: (p.webUrl as string | null) ?? null,
    calendlyUrl: (p.calendlyUrl as string | null) ?? null,
    activo: p.activo,
  }));

  return (
    <PageShell
      titulo="Programas"
      descripcion="Cada programa con su slug, ticket, web y Calendly. Se crean y desactivan sin tocar código."
    >
      <ProgramasAdmin programas={vista} />
    </PageShell>
  );
}
