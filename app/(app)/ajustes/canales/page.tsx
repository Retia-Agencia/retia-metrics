import { paginaConRol } from "@/lib/auth/page-guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { canales as catalogoCanales } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { ErrorDeApp } from "@/lib/errors";
import { PageShell } from "@/components/page-shell";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { CanalesAdmin, type CanalVista } from "@/components/admin/canales-admin";

export const dynamic = "force-dynamic";

export default async function CanalesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  // Los Canales los administra quien maneja pauta (ADR 0052, ADR 0077 punto 4): el
  // paid trafficker, el gerente y el developer. La guarda admite esos roles base y
  // `manejaPauta` sobre el ROL DE VISTA cierra la vista `closer` (ADR 0025, ADR 0028).
  const session = await paginaConRol("gerente", "paid_trafficker");
  if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  const { desde } = await searchParams;

  const [filas, todasLasAreas] = await Promise.all([
    catalogoCanales(db).listar(),
    catalogoAreas(db).listar(),
  ]);
  const areasActivas = todasLasAreas.filter((area) => area.activo).map((area) => ({ id: area.id, nombre: String(area.nombre) }));
  const nombreArea = new Map(areasActivas.map((area) => [area.id, area.nombre]));
  const vista = filas.map((fila) => ({
    id: fila.id,
    nombre: String(fila.nombre),
    utmSource: fila.utmSource === null ? null : String(fila.utmSource),
    utmMedium: String(fila.utmMedium),
    areaId: String(fila.areaId),
    area: nombreArea.get(String(fila.areaId)) ?? "Área inactiva",
    formato: fila.formato as CanalVista["formato"],
    activo: fila.activo,
  }));

  return (
    <PageShell
      titulo="Canales"
      descripcion="De qué canal y área viene cada envío."
      volver={{ desde, porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
      fija
    >
      <PantallaFija>
        <p className="shrink-0 text-sm text-muted-foreground">
          Desde el 14-oct el área y el canal de un envío salen de una regla, no de este catálogo. Esta
          pantalla se retira con Hub › Origen.
        </p>
        <CanalesAdmin canales={vista} areas={areasActivas} />
      </PantallaFija>
    </PageShell>
  );
}
