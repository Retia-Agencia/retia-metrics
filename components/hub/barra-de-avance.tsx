import { num } from "@/lib/format";

/**
 * Una barra de avance que se explica sola (Mani, 4-nov): el 100 % es el objetivo y su cifra va escrita al
 * final, y lo llenado es lo que llevamos. Sin marcas sueltas: lo que se esperaba a hoy se dice con una frase
 * junto al número, no con una raya. Una barra sin relleno nunca se pinta: con 0 llevado no hay barra, y el
 * objetivo ya lo dice el texto de quien la usa. La usan Hoy y "¿Vamos a llegar?".
 */
export function BarraDeAvance({ llevamos, objetivo, unidad = "", tono = "bg-primary" }: {
  llevamos: number;
  objetivo: number;
  unidad?: string;
  /** Una clase de fondo de Tinta (`bg-tono-exito`...); por defecto el acento. */
  tono?: string;
}) {
  if (llevamos <= 0 || objetivo <= 0) return null;
  const ancho = Math.min(100, (llevamos / objetivo) * 100);
  return (
    <div className="space-y-1">
      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(llevamos)}
        aria-valuemax={Math.round(objetivo)}
        aria-label={`Llevamos ${num(llevamos, 1)} de ${num(objetivo, 1)}${unidad}`}
      >
        <div className={`h-full rounded-full ${tono}`} style={{ width: `${ancho}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
        <span>0</span>
        <span>Objetivo: {num(objetivo, 1)}{unidad}</span>
      </div>
    </div>
  );
}
