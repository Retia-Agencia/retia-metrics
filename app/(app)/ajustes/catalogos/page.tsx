import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { PageShell } from "@/components/page-shell";
import { CatalogosAdmin, type CatalogoVista } from "@/components/catalogos-admin";
import { REGISTRO_CATALOGOS } from "@/lib/catalogo/registro";
import { vinculosDePlataformas } from "@/lib/catalogo/plataformas";
import { programasActivos } from "@/lib/queries/programas";

export const dynamic = "force-dynamic";

/**
 * Pantalla unica de administracion de catalogos (ticket 013, ADR 0012). Motivos (y los
 * demas catalogos del registro) los administra SOLO quien administra (gerente y
 * developer, `esAdministrador`): desde el ticket 178 (ADR 0077) un closer no entra aqui,
 * y las plataformas de pago que antes creaba desde esta pantalla las administra ahora
 * desde la tab Programa.
 *
 * La guarda admite al developer por `puedeAcceder` (ADR 0025) y `esAdministrador` sobre
 * el ROL DE VISTA (ADR 0028) cierra la vista `closer` —nunca `rol === "..."` (ADR 0025
 * punto 5): el developer administra y quedarse afuera de su propia app es el bug que este
 * repo ya arreglo dos veces.
 */
export default async function CatalogosPage() {
  const session = await paginaConRol("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);

  // Quien llega aqui administra: ve todos los catalogos del registro y todos los
  // programas activos para vincular una plataforma.
  const programas = await programasActivos(db);

  // Los vinculos de TODAS las plataformas en una sola consulta (nunca un N+1).
  const necesitaVinculos = REGISTRO_CATALOGOS.some((c) => c.vinculadoAProgramas);
  const vinculos = necesitaVinculos ? await vinculosDePlataformas(db) : new Map<string, string[]>();

  const catalogos: CatalogoVista[] = await Promise.all(
    REGISTRO_CATALOGOS.map(async (def) => {
      const items = await def.fabrica(db).listar();
      return {
        slug: def.slug,
        nombre: def.nombre,
        // Quien llega aqui administra, asi que puede renombrar, desactivar y borrar en
        // todos los catalogos.
        puedeAdministrar: true,
        programas: def.vinculadoAProgramas
          ? programas.map((p) => ({ id: p.id, nombre: p.nombre }))
          : undefined,
        items: items.map((i) => ({
          id: i.id,
          nombre: String(i.nombre),
          activo: i.activo,
          programas: def.vinculadoAProgramas ? (vinculos.get(i.id) ?? []) : undefined,
        })),
      };
    }),
  );

  return (
    <PageShell
      titulo="Motivos"
      descripcion="Se usan al perder, retroceder o recuperar un deal."
    >
      <CatalogosAdmin catalogos={catalogos} />
    </PageShell>
  );
}
