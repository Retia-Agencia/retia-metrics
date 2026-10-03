import Link from "next/link";

/** Las tabs de Mi espacio (ticket 172), en el orden de la reunión: Pendientes arriba. */
export const TABS_MI_ESPACIO = [
  ["pendientes", "Pendientes"],
  ["deals", "Mis deals"],
  ["llamadas", "Mis llamadas"],
  ["students", "Mis students"],
] as const;

export type TabMiEspacio = (typeof TABS_MI_ESPACIO)[number][0];

/**
 * La navegación por tabs de Mi espacio (ticket 172): enlaces que cambian `?tab=` sin
 * perder el programa. Es un componente de servidor; la tab activa la decide la URL, no el
 * cliente (ADR 0023).
 */
export function TabsDeMiEspacio({ slug, actual }: { slug: string; actual: TabMiEspacio }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b" aria-label="Secciones de Mi espacio">
      {TABS_MI_ESPACIO.map(([valor, etiqueta]) => (
        <Link
          key={valor}
          href={`/mi-espacio?programa=${slug}&tab=${valor}`}
          aria-current={valor === actual ? "page" : undefined}
          className={
            valor === actual
              ? "border-b-2 border-marca px-3 py-2 text-sm font-medium text-marca"
              : "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          {etiqueta}
        </Link>
      ))}
    </nav>
  );
}
