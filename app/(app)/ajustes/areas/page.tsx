import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { canales as catalogoCanales } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { AreasAdmin } from "@/components/admin/areas-admin";

export const dynamic = "force-dynamic";

/**
 * `/ajustes/areas`: las áreas de origen (ADR 0043), separadas de Canales por el ticket
 * 173. Un área agrupa canales y se usa en el origen declarado y en el rendimiento por
 * área; por eso la administra quien ADMINISTRA (gerente y developer, `esAdministrador`),
 * no quien maneja pauta. La guarda admite al developer por `puedeAcceder` (ADR 0025) y
 * `esAdministrador` sobre el ROL DE VISTA cierra la vista `closer` —nunca `rol === "..."`.
 */
export default async function AreasPage() {
  const session = await paginaConRol("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);

  const [todasLasAreas, canales] = await Promise.all([
    catalogoAreas(db).listar(),
    catalogoCanales(db).listar(),
  ]);
  const canalesPorArea = new Map<string, number>();
  for (const canal of canales) {
    const clave = String(canal.areaId);
    canalesPorArea.set(clave, (canalesPorArea.get(clave) ?? 0) + 1);
  }
  const vistaAreas = todasLasAreas.map((area) => ({
    id: area.id,
    nombre: String(area.nombre),
    activo: area.activo,
    canales: canalesPorArea.get(area.id) ?? 0,
  }));

  return (
    <PageShell
      titulo="Áreas"
      descripcion="Agrupan los canales por área de origen."
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
      fija
    >
      <PantallaFija>
        <p className="shrink-0 text-sm text-muted-foreground">
          Las áreas se usan en el origen declarado de un lead y en el rendimiento por área del
          dashboard. Desactivar un área deja sus canales en “Área inactiva”.
        </p>
        <AreasAdmin areas={vistaAreas} />
      </PantallaFija>
    </PageShell>
  );
}
