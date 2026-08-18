import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { ProximaFase } from "@/components/proxima-fase";

export default async function MiDiaPage() {
  const session = await paginaConRol("closer");
  return (
    <PageShell
      titulo="Mi día"
      descripcion={`Agendas y cola de ${session.user.name ?? "hoy"}.`}
    >
      <ProximaFase
        fase={4}
        entrega="Tus agendas de hoy y mañana con la ficha del lead, tu cola de setteo y el formulario de registro de llamada que escribe de vuelta en la BBDD."
      />
    </PageShell>
  );
}
