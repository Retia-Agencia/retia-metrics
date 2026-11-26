import { comparacionesDe, nombreDePedido, type PeriodoResuelto } from "@/lib/periodo";
import { hoyEnBogota } from "@/lib/format";
import type { VistaDeMisMetricas } from "@/lib/queries/mi-espacio-metricas";
import type { DatosDeMetricas } from "@/lib/mi-espacio/datos-metricas";
import { cifrasDeMiPrograma } from "@/lib/hub/cifras-de-mi-espacio";
import { explicacionesDeMiEspacio } from "@/lib/hub/explicaciones-de-mi-espacio";
import { Cifra } from "@/components/cifra-con-lista";
import { SelectorPeriodo } from "@/components/selector-periodo";

/** Contra qué se compara, en palabras («el periodo anterior»), igual que el Hub. */
function referenciaDe(periodo: PeriodoResuelto): string | undefined {
  const primera = comparacionesDe(periodo)[0];
  return primera ? nombreDePedido(primera.pedido, periodo.preset) : undefined;
}

function BloqueDePrograma({ vista, hoy }: { vista: VistaDeMisMetricas; hoy: string }) {
  const cifras = cifrasDeMiPrograma({ vista, referencia: referenciaDe(vista.periodo), explicaciones: explicacionesDeMiEspacio(), hoy });
  return (
    <div className="space-y-4">
      <SelectorPeriodo periodo={vista.periodo} anteriorDisponible={vista.anteriorDisponible} />
      {vista.periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{vista.periodo.aviso}</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={`Métricas de ${vista.programa.nombre}`}>
        {[cifras.citas, cifras.realizadas, cifras.noAsistio, cifras.ventas, cifras.cierre, cifras.sinResultado, ...cifras.entroACaja, cifras.comision].map((cifra) =>
          cifra ? <Cifra key={`${cifra.concepto}:${cifra.explicacion.filtros.map(([, v]) => v).join("|")}`} cifra={cifra} /> : null)}
      </section>
    </div>
  );
}

export function TabMetricas({ datos }: { datos: DatosDeMetricas }) {
  const hoy = hoyEnBogota();
  return <BloqueDePrograma vista={datos.vista} hoy={hoy} />;
}
