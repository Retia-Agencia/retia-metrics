import type { ReactNode } from "react";
import Link from "next/link";
import { AyudaDeSeccion } from "@/components/hub/info-de-pagina";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tasa } from "@/components/dashboard/piezas";
import { num } from "@/lib/format";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";

/** Un programa por columna, lado a lado: ninguna tasa se suma entre programas (ADR 0048). */
const columnas = (n: number) =>
  n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-1 lg:grid-cols-2 print:grid-cols-2" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-3";

export function Lado({ programas, children }: {
  programas: ProgramaDelReporte[];
  children: (p: ProgramaDelReporte) => ReactNode;
}) {
  return (
    <div className={`grid gap-4 ${columnas(programas.length)}`}>
      {programas.map((p) => (
        <div key={p.programa.id} className="min-w-0 space-y-3">
          {programas.length > 1 ? <h4 className="text-sm font-semibold">{p.programa.nombre}</h4> : null}
          {children(p)}
        </div>
      ))}
    </div>
  );
}

/** Una sección de Hoy: ancla para la tabla de contenido, título con su "?" y, al imprimir, su fuente. */
export function Bloque({ id, titulo, pregunta, fuente, children }: {
  id: string;
  titulo: string;
  /** La pregunta que responde el bloque, en una línea. */
  pregunta?: string;
  fuente: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <div className="bloque-titulo">
        <h3 className="flex items-center gap-1.5 text-lg font-semibold">{titulo}<AyudaDeSeccion seccion={id} etiqueta={titulo} /></h3>
        {pregunta ? <p className="text-sm text-muted-foreground">{pregunta}</p> : null}
      </div>
      {children}
      <p className="no-partir hidden text-[11px] leading-snug text-muted-foreground print:block"><strong>Fuente:</strong> {fuente}</p>
    </section>
  );
}

/** Una tarjeta con título, su "?" y el contenido: el patrón de las cifras de arriba, para todo lo demás. */
export function Ficha({ titulo, ayuda, valor, children }: {
  titulo: string;
  /** La sección del Info a la que lleva el "?". */
  ayuda?: string;
  valor?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center justify-between gap-1 text-xs font-medium tracking-normal text-muted-foreground">
          <span>{titulo}</span>
          {ayuda ? <AyudaDeSeccion seccion={ayuda} etiqueta={titulo} /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {valor !== undefined ? <div className="cifra break-words text-2xl font-semibold">{valor}</div> : null}
        {children}
      </CardContent>
    </Card>
  );
}

/** Una cifra que abre su lista por enlace; sin enlace (vista de todos los programas) es solo texto. */
export function CifraConEnlace({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return <Link href={href} className="cifra underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">{children}</Link>;
}

export const cumplimiento = (llevamos: number, objetivo: number | null) => (objetivo && objetivo > 0 ? tasa(llevamos / objetivo) : "—");
export const numeroOGuion = (valor: number | null, decimales = 1) => (valor === null ? "—" : num(valor, decimales));
