import { paginaConRol } from "@/lib/auth/page-guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { canales as catalogoCanales } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { ErrorDeApp } from "@/lib/errors";
import { clasificacionDeEnvios } from "@/lib/atribucion/pares-sin-clasificar";
import { PageShell } from "@/components/page-shell";
import { CanalesAdmin, type CanalVista } from "@/components/admin/canales-admin";

export const dynamic = "force-dynamic";

export default async function CanalesPage() {
  // Los Canales los administra quien maneja pauta (ADR 0052, ADR 0077 punto 4): el
  // paid trafficker, el gerente y el developer. La guarda admite esos roles base y
  // `manejaPauta` sobre el ROL DE VISTA cierra la vista `closer` (ADR 0025, ADR 0028).
  const session = await paginaConRol("gerente", "paid_trafficker");
  if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);

  const [filas, todasLasAreas, clasificacion] = await Promise.all([
    catalogoCanales(db).listar(),
    catalogoAreas(db).listar(),
    clasificacionDeEnvios(db),
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
    // Solo un canal activo clasifica; el inactivo no tiene conteo (null), no un 0.
    envios: fila.activo ? (clasificacion.enviosPorCanal.get(fila.id) ?? 0) : null,
  }));

  return (
    <PageShell titulo="Canales" descripcion="De qué canal y área viene cada envío.">
      <div className="space-y-6">
        {/* Por qué no se crean solos y cómo se arma un link con UTM (builder, 092). */}
        <p className="text-sm text-muted-foreground">
          Los canales no se crean automáticamente: un dedazo (<span className="cifra">fb</span>) o una
          macro de Meta sin expandir se volvería un canal y “sin clasificar” desaparecería. Los links
          con UTM se arman con el generador del CRM (el builder de captación), nunca a mano.
        </p>
        <CanalesAdmin canales={vista} areas={areasActivas} pares={clasificacion.paresSinClasificar} />
      </div>
    </PageShell>
  );
}
