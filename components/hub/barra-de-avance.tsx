import { num } from "@/lib/format";

/**
 * Una barra de avance que se explica sola (Mani, 4-nov): el 100 % es el objetivo y su cifra va escrita al
 * final, lo llenado es lo que llevamos y la raya es lo esperado a hoy, también con su cifra. Nunca una barra
 * sin números. La usan Hoy y "¿Vamos a llegar?".
 */
export function BarraDeAvance({ llevamos, objetivo, esperado, unidad = "", tono = "bg-primary" }: {
  llevamos: number;
  objetivo: number;
  esperado?: number | null;
  unidad?: string;
  /** Una clase de fondo de Tinta (`bg-tono-exito`...); por defecto el acento. */
  tono?: string;
}) {
  const ancho = Math.min(100, Math.max(0, (llevamos / objetivo) * 100));
  const marca = esperado == null ? null : Math.min(100, Math.max(0, (esperado / objetivo) * 100));
  return (
    <div className="space-y-1">
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(llevamos)}
        aria-valuemax={Math.round(objetivo)}
        aria-label={`Llevamos ${num(llevamos, 1)} de ${num(objetivo, 1)}${unidad}`}
      >
        <div className={`h-full rounded-full ${tono}`} style={{ width: `${ancho}%` }} />
        {marca === null ? null : <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${marca}%` }} />}
      </div>
      <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
        <span>0</span>
        {marca === null ? null : <span>Esperado a hoy: {num(esperado!, 1)}{unidad}</span>}
        <span>Objetivo: {num(objetivo, 1)}{unidad}</span>
      </div>
    </div>
  );
}
