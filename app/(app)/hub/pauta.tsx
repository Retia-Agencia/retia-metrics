import { Enlace } from "@/components/enlace";
import { Cifra } from "@/components/cifra-con-lista";
import { AgendasPorPrograma } from "@/components/pauta/agendas-por-programa";
import { CumplimientoDeCohorte } from "@/components/pauta/cumplimiento";
import { TablaSemanalDePauta } from "@/components/pauta/tabla-semanal";
import { Button } from "@/components/ui/button";
import { cifrasDeTotalesDePauta } from "@/lib/hub/cifras-de-pauta-de-todos";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { DatosDelHub } from "@/lib/queries/hub-todos";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import { queryDePeriodo } from "@/lib/queries/vista-todos";
import { UNIVERSO_PAUTA } from "@/lib/vocabulario-metricas";

/**
 * Pauta de todos los programas (422): la misma forma del Hub de un programa, programa por programa y sin cruzarlos
 * (ADR 0043). Arriba, una franja con lo que el ADR 0048 deja sumar, cada total en su unidad; luego una gráfica de
 * agendas por programa (solo cantidades); y, por programa, su cumplimiento y su tabla semanal. «Origen y calidad» (ROAS
 * por campaña, qué llega sin origen, el embudo) es del Hub del programa: aquí solo se enlaza.
 */
export function PautaPorPrograma({ filas, periodo, hoy, origen, puedeVerVentas, listasQueAbre }: {
  filas: DatosDelHub["pauta"];
  periodo: PeriodoResuelto;
  hoy: string;
  /** La URL de esta pantalla, con su query: de ahí salen los interruptores de la gráfica y la vuelta de las listas. */
  origen: string;
  puedeVerVentas: boolean;
  listasQueAbre: readonly Metrica[];
}) {
  const totales = cifrasDeTotalesDePauta({ programas: filas, rango: periodo.a, hoy });
  return <section id="pauta" className="space-y-6">
    <div><h2 className="text-xl font-semibold">Pauta</h2><p className="text-xs text-muted-foreground">{UNIVERSO_PAUTA}</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Totales de pauta, sumas en la misma unidad">
      {totales.map((cifra) => <Cifra key={cifra.concepto} cifra={cifra} />)}
    </div>
    <AgendasPorPrograma programas={filas.map(({ programa, semanal }) => ({ nombre: programa.nombre, dias: semanal.dias }))}
      rango={periodo.a} origen={origen} hoy={hoy} />
    {filas.map(({ programa, cohorteId, cohorteCodigo, semanal }) => {
      const base = `/p/${encodeURIComponent(programa.slug)}/hub`;
      const hrefDePauta = (vista?: "calidad") => {
        const q = new URLSearchParams(queryDePeriodo(periodo));
        q.set("seccion", "pauta");
        if (vista) q.set("vista", vista);
        return `${base}?${q}`;
      };
      return <div key={programa.id} className="space-y-4" data-programa={programa.slug}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">
            <Button variant="link" nativeButton={false} render={<Enlace precarga="al-pasar" href={hrefDePauta()} />}>{programa.nombre}</Button>
          </h3>
          <Button variant="link" size="sm" nativeButton={false} render={<Enlace precarga="nunca" href={hrefDePauta("calidad")} />}>
            Origen y calidad →
          </Button>
        </div>
        <CumplimientoDeCohorte programId={programa.id} programa={programa.nombre} slug={programa.slug} cohorteId={cohorteId} hoy={hoy}
          origen={origen} puedeVerVentas={puedeVerVentas} />
        <TablaSemanalDePauta programId={programa.id} programa={programa.nombre} cohorte={cohorteCodigo ?? undefined} slug={programa.slug}
          rango={periodo.a} periodo={periodo} origen={origen} hoy={hoy} cohorteId={cohorteId} listasQueAbre={listasQueAbre}
          vistaLeida={semanal} sinGrafica />
      </div>;
    })}
  </section>;
}
