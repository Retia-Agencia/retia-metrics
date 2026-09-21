import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { ProximaFase } from "@/components/proxima-fase";

export const dynamic = "force-dynamic";

/**
 * Pantalla `/mi-dia` del closer (ticket 003, ADR 0003).
 *
 * ⚠️ Vaciada por el ticket 038. La pantalla de registro —buscar la persona,
 * registrar la llamada, la venta y su primer abono— se fue con `sales`: en el
 * modelo nuevo registrar una venta es crear o mover un DEAL, y eso solo puede
 * pasar por `moverEtapa()`, que nace en la etapa 2.
 *
 * Lo que la reemplaza no es la misma pantalla con otro backend: es un inbox de
 * Leads y Deals con reclamo (decision de Mani, 21-sep), y se define en la etapa 6
 * con el motor funcionando delante.
 *
 * La GUARDA se queda intacta: la ruta sigue siendo del closer y el gerente no
 * entra (ADR 0003), el developer si (ADR 0025). Una pantalla vacia no es razon
 * para aflojar un permiso, y `tests/paginas.test.ts` la sigue midiendo.
 */
export default async function MiDiaPage() {
  await paginaConRol("closer");

  return (
    <PageShell
      titulo="Mi día"
      descripcion="El inbox de leads y deals llega con el motor de etapas."
    >
      <ProximaFase
        fase={6}
        entrega="Inbox de Leads y Deals con filtros y reclamo. El registro de llamadas, ventas y abonos vuelve en la etapa 4, sobre el motor de etapas."
      />
    </PageShell>
  );
}
