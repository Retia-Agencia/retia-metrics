import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { ProximaFase } from "@/components/proxima-fase";

export default async function AjustesPage() {
  await paginaConRol("gerente");
  return (
    <PageShell titulo="Ajustes" descripcion="Fuentes de datos, usuarios y parámetros de corte.">
      <ProximaFase
        fase={1}
        entrega="Fuentes de Google Sheets con su mapeo de columnas editable, estado de la última sincronización y botón de sincronizar ahora."
      />
    </PageShell>
  );
}
