import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { CatalogosAdmin, type CatalogoVista } from "@/components/catalogos-admin";
import { REGISTRO_CATALOGOS } from "@/lib/catalogo/registro";

export const dynamic = "force-dynamic";

/**
 * Pantalla unica de administracion de catalogos (ticket 013, ADR 0012).
 *
 * Una pestaña por catalogo del registro, todas sobre un solo componente generico.
 * El guard de rol corre primero: un closer nunca llega a leer la base. Los items se
 * leen por catalogo directo del molde; las mutaciones viven en `./acciones.ts`.
 */
export default async function CatalogosPage() {
  await paginaConRol("gerente");

  const catalogos: CatalogoVista[] = await Promise.all(
    REGISTRO_CATALOGOS.map(async (def) => {
      const items = await def.fabrica(db).listar();
      return {
        slug: def.slug,
        nombre: def.nombre,
        items: items.map((i) => ({
          id: i.id,
          nombre: String(i.nombre),
          activo: i.activo,
        })),
      };
    }),
  );

  return (
    <PageShell
      titulo="Catálogos"
      descripcion="Listas que el equipo amplía sin tocar código."
    >
      <CatalogosAdmin catalogos={catalogos} />
    </PageShell>
  );
}
