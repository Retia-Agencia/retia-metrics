import { paginaConSesion } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { ProximaFase } from "@/components/proxima-fase";

export default async function DocumentosPage() {
  await paginaConSesion();
  return (
    <PageShell
      titulo="Documentos"
      descripcion="Playbook, guías y pipelines vigentes."
    >
      <ProximaFase
        fase={5}
        entrega="Repositorio con versiones, marca de vigente e histórico, visor en línea y descarga."
      />
    </PageShell>
  );
}
