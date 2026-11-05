import type { ReactNode } from "react";

/**
 * Piezas visuales del panel Info: nada de párrafos. Un paso es una caja con su cifra; una fórmula es un
 * recibo (operador, nombre, valor) que termina en el resultado. Sin estado: sirven en el servidor.
 */

export function Frase({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export interface PasoDeInfo {
  titulo: string;
  valor?: string;
  nota?: string;
}

/** Cajas unidas por flechas: "leads → citas → realizadas → ventas". */
export function Pasos({ pasos }: { pasos: PasoDeInfo[] }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-2">
      {pasos.map((paso, indice) => (
        <li key={paso.titulo} className="flex items-center gap-2">
          {indice > 0 ? <span aria-hidden="true" className="text-muted-foreground">→</span> : null}
          <div className="rounded-lg bg-muted px-3 py-2 text-center">
            <div className="text-xs text-muted-foreground">{paso.titulo}</div>
            {paso.valor ? <div className="cifra text-sm font-semibold">{paso.valor}</div> : null}
            {paso.nota ? <div className="text-[11px] text-muted-foreground">{paso.nota}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface RenglonDeFormula {
  operador?: "÷" | "×" | "−" | "+";
  nombre: string;
  valor: string;
  /** De dónde sale el valor, en pocas palabras. */
  origen?: string;
}

/** Un recibo: cada renglón con su operador y de dónde sale, y la línea final con el resultado. */
export function Formula({ renglones, resultado }: { renglones: RenglonDeFormula[]; resultado: { nombre: string; valor: string } }) {
  return (
    <div className="rounded-lg bg-muted p-3 text-sm">
      <ul className="space-y-1.5">
        {renglones.map((r) => (
          <li key={r.nombre} className="flex items-baseline gap-2">
            <span className="w-4 shrink-0 text-center text-muted-foreground" aria-hidden="true">{r.operador ?? ""}</span>
            <span className="min-w-0 flex-1">
              {r.nombre}
              {r.origen ? <span className="block text-xs text-muted-foreground">{r.origen}</span> : null}
            </span>
            <span className="cifra shrink-0 font-medium">{r.valor}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between gap-2 border-t pt-2 font-semibold">
        <span>= {resultado.nombre}</span>
        <span className="cifra">{resultado.valor}</span>
      </div>
    </div>
  );
}

/** Una barra de ejemplo que dice qué es el 100 %: el relleno es una parte del total con su cifra. */
export function BarraDeEjemplo({ etiqueta, parte, total, textoParte }: { etiqueta: string; parte: number; total: number; textoParte: string }) {
  const ancho = total > 0 ? Math.min(100, Math.max(0, (parte / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs"><span>{etiqueta}</span><span className="cifra text-muted-foreground">{textoParte}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${ancho}%` }} /></div>
    </div>
  );
}

/** Pares "palabra → qué es": el glosario corto de una sección. */
export function Palabras({ items }: { items: { palabra: string; significa: string }[] }) {
  return (
    <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
      {items.map((i) => (
        <div key={i.palabra} className="contents">
          <dt className="font-medium">{i.palabra}</dt>
          <dd className="text-muted-foreground">{i.significa}</dd>
        </div>
      ))}
    </dl>
  );
}
