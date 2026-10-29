import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Pestañas y selector de programa de /media (ticket 321). Todo es enlace: la pestaña y el
 * programa viven en la URL (`?tab=` y `?programa=`), asi que la pagina sigue siendo del servidor,
 * se puede compartir y el boton "atras" funciona. Mobile-first: las filas se desplazan en
 * horizontal en vez de partirse.
 */
export const PESTANAS_DE_MEDIA = [
  {
    id: "creadores",
    etiqueta: "Creadores y piezas",
    vacia: null,
  },
  {
    id: "hoy",
    etiqueta: "Hoy",
    vacia: "Aquí verás qué publicar hoy y qué te falta por subir. Llega con el ticket 326: todavía no hay un pipeline de media que mostrar.",
  },
  {
    id: "banco",
    etiqueta: "Banco",
    vacia: "Aquí vivirá el banco de contenido y de ideas. Llega con los tickets 324 y 325.",
  },
  {
    id: "insights",
    etiqueta: "Insights",
    vacia: "Aquí verás qué contenido trae leads y ventas. Llega con el ticket 330, cuando la escalera de conversión se cruce con cada pieza.",
  },
] as const;
export type PestanaDeMedia = (typeof PESTANAS_DE_MEDIA)[number]["id"];

export function pestanaValida(valor: string | undefined): PestanaDeMedia {
  return PESTANAS_DE_MEDIA.find((p) => p.id === valor)?.id ?? "creadores";
}

/** El selector de programa: `programa` es un id o "ninguno"; vacio = todos los del alcance. */
export const SIN_PROGRAMA = "ninguno";

function href(tab: PestanaDeMedia, programa: string | undefined) {
  const q = new URLSearchParams();
  if (tab !== "creadores") q.set("tab", tab);
  if (programa) q.set("programa", programa);
  const s = q.toString();
  return s ? `/media?${s}` : "/media";
}

const pildora = "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm transition-colors";

export function PestanasDeMedia({
  tab,
  programa,
  programas,
  conSinPrograma,
}: {
  tab: PestanaDeMedia;
  programa: string | undefined;
  programas: { id: string; nombre: string }[];
  conSinPrograma: boolean;
}) {
  const opciones = [
    { valor: undefined, etiqueta: "Todos" },
    ...programas.map((p) => ({ valor: p.id as string | undefined, etiqueta: p.nombre })),
    ...(conSinPrograma ? [{ valor: SIN_PROGRAMA as string | undefined, etiqueta: "Sin programa" }] : []),
  ];
  return (
    <div className="space-y-3">
      <nav aria-label="Secciones de media" className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        {PESTANAS_DE_MEDIA.map((p) => (
          <Link
            key={p.id}
            href={href(p.id, programa)}
            aria-current={p.id === tab ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              p.id === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>
      <nav aria-label="Programa" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {opciones.map((o) => (
          <Link
            key={o.valor ?? "todos"}
            href={href(tab, o.valor)}
            aria-current={o.valor === programa ? "true" : undefined}
            className={cn(
              pildora,
              o.valor === programa ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.etiqueta}
          </Link>
        ))}
      </nav>
    </div>
  );
}
