import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { canales as catalogoCanales } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { ErrorDeApp } from "@/lib/errors";
import { clasificacionDeEnvios } from "@/lib/atribucion/pares-sin-clasificar";
import { PageShell } from "@/components/page-shell";
import { CanalesAdmin, type CanalVista } from "@/components/admin/canales-admin";
import { AreasAdmin } from "@/components/admin/areas-admin";

export const dynamic = "force-dynamic";

export default async function CanalesPage() {
  const session = await paginaConRol("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);

  const [filas, todasLasAreas, clasificacion] = await Promise.all([
    catalogoCanales(db).listar(),
    catalogoAreas(db).listar(),
    clasificacionDeEnvios(db),
  ]);
  const areasActivas = todasLasAreas.filter((area) => area.activo).map((area) => ({ id: area.id, nombre: String(area.nombre) }));
  const nombreArea = new Map(areasActivas.map((area) => [area.id, area.nombre]));
  const canalesPorArea = new Map<string, number>();
  for (const fila of filas) canalesPorArea.set(String(fila.areaId), (canalesPorArea.get(String(fila.areaId)) ?? 0) + 1);
  const vistaAreas = todasLasAreas.map((area) => ({
    id: area.id,
    nombre: String(area.nombre),
    activo: area.activo,
    canales: canalesPorArea.get(area.id) ?? 0,
  }));
  const vista = filas.map((fila) => ({
    id: fila.id,
    nombre: String(fila.nombre),
    utmSource: fila.utmSource === null ? null : String(fila.utmSource),
    utmMedium: String(fila.utmMedium),
    areaId: String(fila.areaId),
    area: nombreArea.get(String(fila.areaId)) ?? "Área inactiva",
    formato: fila.formato as CanalVista["formato"],
    activo: fila.activo,
    // Solo un canal activo clasifica; el inactivo no tiene conteo (null), no un 0.
    envios: fila.activo ? (clasificacion.enviosPorCanal.get(fila.id) ?? 0) : null,
  }));

  return (
    <PageShell titulo="Canales" descripcion="De qué canal y área viene cada envío.">
      <div className="space-y-6">
        <AreasAdmin areas={vistaAreas} />
        <CanalesAdmin canales={vista} areas={areasActivas} pares={clasificacion.paresSinClasificar} />
      </div>
    </PageShell>
  );
}
