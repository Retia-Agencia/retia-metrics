import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { ProgramSwitcher } from "@/components/program-switcher";
import { ProximaFase } from "@/components/proxima-fase";

export default async function ComunicartePage() {
  await paginaConRol("gerente", "closer");
  return (
    <PageShell
      titulo="Comunicarte"
      descripcion="Corte C2 — arranca y cierra ventas el 22 de septiembre de 2026."
      acciones={<ProgramSwitcher />}
    >
      <ProximaFase
        fase={2}
        entrega="Embudo, tasas contra C1, ritmo por día hábil, tarjetas de caja y pauta, tabla de closers y el panel de cambios."
      />
    </PageShell>
  );
}
