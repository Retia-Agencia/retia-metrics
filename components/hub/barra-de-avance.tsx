import { num } from "@/lib/format";
import type { TonoDeEstado } from "@/lib/metricas/cifra";

const LLENO: Record<TonoDeEstado | "marca", string> = {
  exito: "bg-tono-exito", alerta: "bg-tono-alerta", peligro: "bg-tono-peligro", marca: "bg-marca",
};

/** El atraso rayado, en el tono del estado (boceto de la Cifra, 10-nov). */
const RAYADO: Record<TonoDeEstado | "marca", string> = {
  exito: "[background:repeating-linear-gradient(45deg,var(--tono-exito)_0_3px,var(--tono-exito-suave)_3px_6px)]",
  alerta: "[background:repeating-linear-gradient(45deg,var(--tono-alerta)_0_3px,var(--tono-alerta-suave)_3px_6px)]",
  peligro: "[background:repeating-linear-gradient(45deg,var(--tono-peligro)_0_3px,var(--tono-peligro-suave)_3px_6px)]",
  marca: "[background:repeating-linear-gradient(45deg,var(--marca)_0_3px,var(--marca-suave)_3px_6px)]",
};

interface BarraConMarca {
  /** Fracciones de 0 a 1, ya calculadas en el servidor (`armarCifra`). */
  lleno: number;
  atraso: number;
  marca: number;
  rotuloDeMarca: string;
  /** Sin estado, la barra va en el acento. */
  tono?: TonoDeEstado | null;
  /** Lectura accesible: "Llevamos 412 de 900". */
  etiqueta: string;
}

interface BarraSimple {
  llevamos: number;
  objetivo: number;
  unidad?: string;
  /** Una clase de fondo de Tinta (`bg-tono-exito`...); por defecto el acento. */
  tono?: string;
}

/**
 * La barra de avance. Dos formas de la misma pieza:
 *
 * - **Con marca** (la Cifra, ticket 419): lleno = lo que llevamos en el tono del estado, **rayado** = el atraso (de lo
 *   que llevamos a lo esperado) y una marca vertical rotulada debajo, "a hoy 558". Nunca una línea sin rótulo (Mani,
 *   10-nov: "una línea blanca que parece puesta al azar"). Las fracciones las calcula el servidor.
 * - **Simple** (Hoy, "¿Vamos a llegar?"): el 100 % es el objetivo, escrito al final. Una barra sin relleno nunca se
 *   pinta. Migra a la forma con marca cuando su bloque pase a la Cifra.
 */
export function BarraDeAvance(props: BarraConMarca | BarraSimple) {
  if ("marca" in props) return <ConMarca {...props} />;
  const { llevamos, objetivo, unidad = "", tono = "bg-primary" } = props;
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

function ConMarca({ lleno, atraso, marca, rotuloDeMarca, tono, etiqueta }: BarraConMarca) {
  const clave = tono ?? "marca";
  // El rótulo no se sale de la tarjeta: se centra en la marca, pero entre el 10 % y el 90 %.
  const posicionDelRotulo = Math.min(0.9, Math.max(0.1, marca));
  return (
    <div className="relative pb-[18px]">
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-tono-neutro-suave"
        role="progressbar"
        aria-valuenow={Math.round(lleno * 100)}
        aria-valuemax={100}
        aria-label={`${etiqueta}. ${rotuloDeMarca}`}
      >
        <div className={`h-full ${LLENO[clave]}`} style={{ width: `${lleno * 100}%` }} />
        {atraso > 0 ? <div className={`h-full ${RAYADO[clave]}`} style={{ width: `${atraso * 100}%` }} /> : null}
      </div>
      <span
        aria-hidden="true"
        className="absolute -top-[3px] h-4 w-0.5 rounded-[1px] bg-foreground opacity-55"
        style={{ left: `calc(${marca * 100}% - 1px)` }}
      />
      <span
        aria-hidden="true"
        className="absolute top-[15px] -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground"
        style={{ left: `${posicionDelRotulo * 100}%` }}
      >
        {rotuloDeMarca}
      </span>
    </div>
  );
}
