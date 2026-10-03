import Link from "next/link";
import type { SeccionId, SeccionMiEspacio } from "@/lib/mi-espacio/secciones";

export type { SeccionId as TabMiEspacio };

/**
 * La navegación por tabs de Mi espacio (tickets 172, 179): enlaces que cambian `?tab=` sin
 * perder el programa. Es un componente de servidor; la tab activa la decide la URL, no el
 * cliente (ADR 0023).
 *
 * Las secciones ya no son una lista fija: las dirige el registro `lib/mi-espacio/secciones.ts`
 * según el rol de vista (ticket 179). La página pasa las que el rol cumple y cuál está
 * activa. El selector de programa solo lo conservan las secciones que lo usan; para las que
 * no, el enlace va a `?tab=` a secas.
 */
export function TabsDeMiEspacio({
  secciones,
  actual,
  slug,
}: {
  secciones: readonly SeccionMiEspacio[];
  actual: SeccionId;
  /** El slug del programa seleccionado, o null si la sección actual no usa selector. */
  slug: string | null;
}) {
  // Con una sola sección no hace falta la barra: no hay a dónde navegar.
  if (secciones.length <= 1) return null;
  return (
    <nav className="flex flex-wrap gap-1 border-b" aria-label="Secciones de Mi espacio">
      {secciones.map((seccion) => {
        const href = seccion.usaSelectorDePrograma && slug
          ? `/mi-espacio?programa=${slug}&tab=${seccion.id}`
          : `/mi-espacio?tab=${seccion.id}`;
        return (
          <Link
            key={seccion.id}
            href={href}
            aria-current={seccion.id === actual ? "page" : undefined}
            className={
              seccion.id === actual
                ? "border-b-2 border-marca px-3 py-2 text-sm font-medium text-marca"
                : "border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {seccion.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
