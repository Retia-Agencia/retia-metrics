import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { opcionesDeTablero, parsearFiltros, tableroKanban, type CampoDeFechaDeDeal } from "@/lib/queries/kanban";
import { PageShell } from "@/components/page-shell";
import { FiltroKanban } from "@/components/deals/filtro-kanban";
import { FiltroFechaLista } from "@/components/filtro-fecha-lista";
import { TableroKanban } from "@/components/deals/tablero-kanban";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { NuevoDeal } from "@/components/deals/nuevo-deal";
import { ETAPA_DE_ENTRADA } from "@/lib/deals/crear-a-mano";

export const dynamic = "force-dynamic";

/** Las fechas que filtra la lista de deals (ticket 141), como en HubSpot. */
const CAMPOS_DE_FECHA = [
  { valor: "creado", etiqueta: "Creado" },
  { valor: "actividad", etiqueta: "Última actividad" },
  { valor: "cierre", etiqueta: "Cierre" },
] as const satisfies readonly { valor: CampoDeFechaDeDeal; etiqueta: string }[];

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * El Kanban de Deals de un programa (ADR 0050, ticket 069). Mismo patrón de guarda y
 * alcance que el Dashboard: `paginaConRol("gerente", "closer")`, `rolDeVista`,
 * `programaVisiblePorSlug` -> `notFound()`. El developer pasa por `esAccesoTotal`; nunca
 * se compara el rol a mano.
 *
 * El filtro sale de la URL, nunca de la sesión (ADR 0023): un closer sin filtro ve el
 * programa completo, igual que un gerente (ADR 0048, dentro de su programa ve todo).
 */
export default async function DealsDelProgramaPage({ params, searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();

  const filtros = parsearFiltros(await searchParams);
  const [tablero, opciones] = await Promise.all([
    tableroKanban(db, programa.id, filtros),
    opcionesDeTablero(db, programa.id),
  ]);

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Deals · tablero"
      acciones={
        <NuevoDeal
          programId={programa.id}
          programaSlug={programa.slug}
          nombreEtapaDeEntrada={NOMBRE_DE_ETAPA[ETAPA_DE_ENTRADA]}
          puedeCrearLead={trabajaLeads(rol)}
        />
      }
    >
      <div className="space-y-4">
        <FiltroFechaLista campos={CAMPOS_DE_FECHA} filtro={filtros.fecha ?? null} />
        <FiltroKanban
          ownerUserId={filtros.ownerUserId ?? null}
          cohorteId={filtros.cohorteId ?? null}
          canal={filtros.canal ?? null}
          antiguedadMinima={filtros.antiguedadMinima ?? null}
          leadQuality={filtros.leadQuality ?? null}
          leadValue={filtros.leadValue ?? null}
          owners={opciones.owners}
          cohortes={opciones.cohortes}
          canales={opciones.canales}
          leadQualities={opciones.leadQualities}
          leadValues={opciones.leadValues}
        />
        <TableroKanban
          columnas={tablero.columnas}
          total={tablero.total}
          mapa={mapaDeTransiciones()}
          nombreDeEtapa={NOMBRE_DE_ETAPA}
          nombreDePendiente={NOMBRE_DE_PENDIENTE}
          tonoDeEtapa={TONO_DE_ETAPA}
          programaSlug={programa.slug}
          areas={opciones.areas}
          cohortes={opciones.cohortes}
          motivos={opciones.motivos}
          inicioDeClases={opciones.inicioDeClases}
          inicioDeLaCohorteActiva={opciones.inicioDeLaCohorteActiva}
          userId={session.user.id}
          administra={esAdministrador(rol)}
        />
      </div>
    </PageShell>
  );
}
