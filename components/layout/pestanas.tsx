import Link from "next/link";
import { num } from "@/lib/format";

export { pestanaActiva, urlConSeccion } from "@/components/layout/pestana-activa";

export type Pestana = {
  id: string;
  etiqueta: string;
  total?: number;
  descripcion: string;
  href: string;
};

export type GrupoDePestanas = {
  titulo?: string;
  pestanas: Pestana[];
};

export function Pestanas({
  grupos,
  activa,
  etiqueta,
}: {
  grupos: GrupoDePestanas[];
  activa: string;
  etiqueta: string;
}) {
  const descripcion = grupos.flatMap((grupo) => grupo.pestanas).find((pestana) => pestana.id === activa)?.descripcion;

  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {grupos.map((grupo, indice) => (
          <div key={grupo.titulo ?? indice} className="inline-flex max-w-full items-center gap-2">
            {grupo.titulo ? <span className="text-xs font-medium text-muted-foreground">{grupo.titulo}</span> : null}
            <div
              className="inline-flex max-w-full shrink-0 self-start overflow-x-auto rounded-full border bg-muted p-0.5 text-xs"
              role="group"
              aria-label={grupo.titulo ? `${etiqueta}: ${grupo.titulo}` : etiqueta}
            >
              {grupo.pestanas.map((pestana) => (
                <Link
                  key={pestana.id}
                  href={pestana.href}
                  aria-current={activa === pestana.id ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${activa === pestana.id ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  {pestana.etiqueta}
                  {pestana.total === undefined ? null : (
                    <>
                      {" · "}<span className="cifra">{num(pestana.total)}</span>
                    </>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
    </div>
  );
}
