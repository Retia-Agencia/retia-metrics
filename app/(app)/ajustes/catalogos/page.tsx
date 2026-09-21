import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { CatalogosAdmin, type CatalogoVista } from "@/components/catalogos-admin";
import { REGISTRO_CATALOGOS } from "@/lib/catalogo/registro";
import { vinculosDePlataformas } from "@/lib/catalogo/plataformas";
import { programasActivos, programasGestionablesPorUsuario } from "@/lib/queries/programas";

export const dynamic = "force-dynamic";

/**
 * Pantalla unica de administracion de catalogos (ticket 013, ADR 0012; enmienda del
 * 20-sep con el ADR 0034).
 *
 * Una pestaña por catalogo del registro, todas sobre un solo componente generico. Lo
 * que cambia con la enmienda es que la pantalla ya no es exclusiva de gerente: un
 * closer entra y se le PROYECTA solo lo que le toca (hoy, las plataformas de pago).
 * Proyectar no es dar permiso — las server actions vuelven a exigirlo—: es no
 * mostrarle pestañas que lo rebotarian.
 *
 * Quien proyecta es el ROL DE VISTA (ADR 0028), no `session.user.rol` crudo, y la
 * pregunta es `esAdministrador` y no `rol === "gerente"` (ADR 0025 punto 5): el
 * developer administra y quedarse afuera de su propia app es el bug que este repo ya
 * arreglo dos veces.
 */
export default async function CatalogosPage() {
  const session = await paginaConRol("gerente", "closer");
  const rolVista = await rolDeVista(session);
  const esAdmin = esAdministrador(rolVista);

  // Un administrador ve todos los catalogos; quien no, solo los compartidos. El
  // filtro sale del registro, no de un literal escrito aca.
  const visibles = esAdmin
    ? REGISTRO_CATALOGOS
    : REGISTRO_CATALOGOS.filter((c) => c.compartidoConClosers);

  // Los programas que el actor puede vincular: todos los activos si administra, sus
  // membresias activas si es closer. Un closer no puede asociar una plataforma a un
  // programa donde no vende, y `asociarPrograma` lo vuelve a verificar en el servidor.
  const programas = esAdmin
    ? await programasActivos(db)
    : await programasGestionablesPorUsuario(session.user.id, "closer", db);

  // Los vinculos de TODAS las plataformas en una sola consulta (nunca un N+1).
  const necesitaVinculos = visibles.some((c) => c.vinculadoAProgramas);
  const vinculos = necesitaVinculos ? await vinculosDePlataformas(db) : new Map<string, string[]>();

  const catalogos: CatalogoVista[] = await Promise.all(
    visibles.map(async (def) => {
      const items = await def.fabrica(db).listar();
      return {
        slug: def.slug,
        nombre: def.nombre,
        // Renombrar, desactivar y borrar son de administracion en TODOS los catalogos,
        // incluidas las plataformas: cambiarle el nombre a PayPal toca las metricas de
        // los dos programas (decision de Mani, 20-sep). Un closer crea y vincula.
        puedeAdministrar: esAdmin,
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
      titulo="Catálogos"
      descripcion="Listas que el equipo amplía sin tocar código."
    >
      <CatalogosAdmin catalogos={catalogos} />
    </PageShell>
  );
}
