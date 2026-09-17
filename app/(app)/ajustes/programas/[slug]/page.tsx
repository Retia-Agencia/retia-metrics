import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { CohortesAdmin, type CohorteVista } from "@/components/cohortes-admin";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { programaPorSlug } from "@/lib/queries/programas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * Administracion de las cohortes de un programa (ticket 014, ADR 0012), solo
 * gerente. La guarda corre PRIMERO, antes de mirar el slug: sin sesion redirige a
 * login aunque el programa no exista, y un closer nunca llega a leer la base.
 *
 * El programa se resuelve por slug sin filtrar por activo: un gerente puede cerrar
 * cohortes de un programa que ya desactivo. Un slug inexistente es 404.
 */
export default async function CohortesPage({ params }: Props) {
  await paginaConRol("gerente");

  const { slug } = await params;
  const programa = await programaPorSlug(slug, db);
  if (!programa) notFound();

  const filas = await listarCohortes(db, programa.id);
  const vista: CohorteVista[] = filas.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    metaCupos: c.metaCupos,
    metaLeadsDia: c.metaLeadsDia ?? null,
    precioUsd: String(c.precioUsd),
    fechaInicioClases: c.fechaInicioClases,
    fechaInicioVentas: c.fechaInicioVentas ?? null,
    fechaCierreVentas: c.fechaCierreVentas,
    trmCohorte: String(c.trmCohorte),
    estado: c.estado,
  }));

  return (
    <PageShell
      titulo={`Cohortes · ${programa.nombre}`}
      descripcion="Código, fechas, metas, precio de referencia y TRM. Máximo una cohorte activa por programa."
    >
      <CohortesAdmin slug={programa.slug} programId={programa.id} cohortes={vista} />
    </PageShell>
  );
}
