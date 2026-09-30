import { eq } from "drizzle-orm";
import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { canales as catalogoCanales } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { areas } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { clasificacionDeEnvios } from "@/lib/atribucion/pares-sin-clasificar";
import { PageShell } from "@/components/page-shell";
import { CanalesAdmin, type CanalVista } from "@/components/admin/canales-admin";

export const dynamic = "force-dynamic";

export default async function CanalesPage() {
  const session = await paginaConRol("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);

  const [filas, areasActivas, clasificacion] = await Promise.all([
    catalogoCanales(db).listar(),
    db.select().from(areas).where(eq(areas.activo, true)),
    clasificacionDeEnvios(db),
  ]);
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
    // Solo un canal activo clasifica; el inactivo no tiene conteo (null), no un 0.
    envios: fila.activo ? (clasificacion.enviosPorCanal.get(fila.id) ?? 0) : null,
  }));

  return <PageShell titulo="Canales" descripcion="De qué canal y área viene cada envío."><CanalesAdmin canales={vista} areas={areasActivas.map(({ id, nombre }) => ({ id, nombre }))} pares={clasificacion.paresSinClasificar} /></PageShell>;
}
