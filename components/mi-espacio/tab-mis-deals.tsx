import { db } from "@/lib/db";
import type { Rol } from "@/lib/auth/roles";
import { esAdministrador } from "@/lib/auth/roles";
import { NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { opcionesDeTablero, parsearFiltros, tableroKanban } from "@/lib/queries/kanban";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { TableroKanban } from "@/components/deals/tablero-kanban";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";

/**
 * Tab "Mis deals" de Mi espacio (ticket 172): el Kanban del programa acotado al usuario
 * (ADR 0075: solo sus deals). Reusa `tableroKanban` con alcance `dueno` y el componente
 * `TableroKanban`, igual que la tab Deals del programa, pero sin el filtro por dueño (ya
 * está acotado) ni "nuevo deal" (eso vive en la tab del programa).
 */
export async function TabMisDeals({
  programId,
  slug,
  userId,
  rol,
  busqueda,
}: {
  programId: string;
  slug: string;
  userId: string;
  rol: Rol;
  busqueda: Record<string, string | string[] | undefined>;
}) {
  const filtros = parsearFiltros(busqueda);
  const origen = origenDeLaPagina("/mi-espacio", busqueda);
  const [tablero, opciones] = await Promise.all([
    tableroKanban(db, programId, { tipo: "dueno", userId }, filtros),
    opcionesDeTablero(db, programId),
  ]);

  return (
    <TableroKanban
      columnas={tablero.columnas}
      total={tablero.total}
      mapa={mapaDeTransiciones()}
      nombreDeEtapa={NOMBRE_DE_ETAPA}
      nombreDePendiente={NOMBRE_DE_PENDIENTE}
      tonoDeEtapa={TONO_DE_ETAPA}
      programaSlug={slug}
      areas={opciones.areas}
      cohortes={opciones.cohortes}
      cohortesDestino={opciones.cohortesDestino}
      motivos={opciones.motivos}
      inicioDeClases={opciones.inicioDeClases}
      inicioDeLaCohorteActiva={opciones.inicioDeLaCohorteActiva}
      userId={userId}
      administra={esAdministrador(rol)}
      origen={origen}
    />
  );
}
