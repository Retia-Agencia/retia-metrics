import { Enlace } from "@/components/enlace";
import { Button } from "@/components/ui/button";
import type { ProgramaVisible } from "@/lib/auth/alcance";
import type { PeriodoResuelto } from "@/lib/periodo";
import { queryDePeriodo } from "@/lib/queries/vista-todos";
import { UNIVERSO_PAUTA } from "@/lib/vocabulario-metricas";

/**
 * Pauta de todos los programas (422), mientras llega el cargador por conjunto (438): cada programa lleva a su Hub, donde
 * están Resultados (cumplimiento, tabla semanal, gráfica) y Origen y calidad. Aquí no se lee nada por programa: la tabla
 * semanal de cada uno crecía lineal con los programas y el guardián de consultas no lo admite. Quedan listos, sin
 * conectar, `lib/hub/cifras-de-pauta-de-todos.ts` (franja de totales sumables) y `components/pauta/agendas-por-programa.tsx`.
 */
export function PautaPorPrograma({ programas, periodo }: { programas: readonly ProgramaVisible[]; periodo: PeriodoResuelto }) {
  const hrefDe = (slug: string, vista?: "calidad") => {
    const q = new URLSearchParams(queryDePeriodo(periodo));
    q.set("seccion", "pauta");
    if (vista) q.set("vista", vista);
    return `/p/${encodeURIComponent(slug)}/hub?${q}`;
  };
  return <section id="pauta" className="space-y-4">
    <div><h2 className="text-xl font-semibold">Pauta</h2><p className="text-xs text-muted-foreground">{UNIVERSO_PAUTA}</p></div>
    <p className="text-sm text-muted-foreground">Cada programa tiene su Pauta: nunca se mezclan. Entra al de cada uno para ver su cumplimiento, su tabla semanal y de dónde vienen sus registros.</p>
    <ul className="space-y-2">
      {programas.map((programa) => <li key={programa.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card p-3.5 shadow-tarjeta">
        <Button variant="link" nativeButton={false} render={<Enlace precarga="al-pasar" href={hrefDe(programa.slug)} />}>{programa.nombre}</Button>
        <Button variant="link" size="sm" nativeButton={false} render={<Enlace precarga="nunca" href={hrefDe(programa.slug, "calidad")} />}>Origen y calidad →</Button>
      </li>)}
    </ul>
  </section>;
}
