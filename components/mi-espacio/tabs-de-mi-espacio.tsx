import { Enlace } from "@/components/enlace";
import type { SeccionId, SeccionMiEspacio } from "@/lib/mi-espacio/secciones";

export type { SeccionId as TabMiEspacio };

/**
 * La navegación por tabs de Mi espacio (tickets 172, 179): enlaces que cambian `?tab=` sin
 * perder el programa. Es un componente de servidor; la tab activa la decide la URL, no el
 * cliente (ADR 0023).
 *
 * Las secciones ya no son una lista fija: las dirige el registro `lib/mi-espacio/secciones.ts`
 * según el rol de vista (ticket 179). La página pasa las que el rol cumple y cuál está
 * activa. El programa del sidebar se conserva también al entrar a una sección global, para
 * que volver a una sección por programa mantenga el mismo contexto.
 */
export function TabsDeMiEspacio({
  secciones,
  actual,
  slug,
}: {
  secciones: readonly SeccionMiEspacio[];
  actual: SeccionId;
  /** El slug del programa seleccionado en el sidebar, si existe. */
  slug: string | null;
}) {
  // Con una sola sección no hace falta la barra: no hay a dónde navegar.
  if (secciones.length <= 1) return null;
  return (
    <nav className="flex flex-wrap gap-1 border-b" aria-label="Secciones de Mi espacio">
      {secciones.map((seccion) => {
        const href = slug
          ? `/mi-espacio?programa=${slug}&tab=${seccion.id}`
          : `/mi-espacio?tab=${seccion.id}`;
        return (
          <Enlace precarga="navegacion"
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
          </Enlace>
        );
      })}
    </nav>
  );
}
