import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { hoyEnBogota } from "@/lib/format";
import { urgenciasDelPrograma } from "@/lib/queries/urgencias";
import { PageShell } from "@/components/page-shell";
import { TarjetaUrgencias } from "@/components/urgencias";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ programa: string }> };

/**
 * La réplica de `🚨 Urgencias` de la hoja (ticket 066), por programa. Mismo alcance que el
 * Dashboard (ADR 0048): gerente y closer en sus programas; un programa fuera del alcance es 404.
 * El día lo entrega el servidor en Bogotá (`hoyEnBogota`), nunca el navegador.
 *
 * Vive en su propia ruta para no tocar el dashboard; su lugar final es una tarjeta dentro de él
 * (`docs/structure.md` §8), y `TarjetaUrgencias` está hecha para montarse ahí tal cual.
 */
export default async function UrgenciasDelProgramaPage({ params }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();

  const vista = await urgenciasDelPrograma(db, programa.id, hoyEnBogota());
  return (
    <PageShell titulo={programa.nombre} descripcion="Urgencias">
      <TarjetaUrgencias vista={vista} />
    </PageShell>
  );
}
