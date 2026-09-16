import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programaActivoPorSlug, programasActivos } from "@/lib/queries/programas";
import { PageShell } from "@/components/page-shell";
import { ProgramSwitcher } from "@/components/program-switcher";
import { ProximaFase } from "@/components/proxima-fase";

type Props = { params: Promise<{ slug: string }> };

export default async function ProgramaPage({ params }: Props) {
  // La guarda corre PRIMERO, antes de mirar el slug: sin sesion redirige a login
  // aunque el programa no exista, y nunca filtra que slugs existen. El dashboard
  // lo ven gerente y closer por igual (ADR 0009).
  await paginaConRol("gerente", "closer");

  const { slug } = await params;
  const programa = await programaActivoPorSlug(slug);
  // No existe o esta inactivo: 404. `notFound()` lanza y corta el render.
  if (!programa) notFound();

  const programas = await programasActivos();

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Dashboard comercial del programa."
      acciones={<ProgramSwitcher programas={programas} />}
    >
      <ProximaFase
        fase={2}
        entrega="Embudo, tasas contra la cohorte anterior, ritmo por día hábil, tarjetas de caja y pauta, tabla de closers y el panel de cambios."
      />
    </PageShell>
  );
}
