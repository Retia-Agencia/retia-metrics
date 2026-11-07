import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, ROLES_DE_OPERACION, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { destinosDeCorreccion, ETAPAS_EN_ORDEN, NOMBRE_DE_COLUMNA, NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE, NOMBRE_DE_VISTA, VISTAS_DEL_TABLERO } from "@/lib/deals/etapas";
import { COOKIE_VISTA_DEL_TABLERO } from "@/lib/deals/vista-recordada";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { type CampoDeFechaDeDeal } from "@/lib/queries/kanban";
import { tableroDeDealsParaActor } from "@/lib/queries/operacion";
import { PageShell } from "@/components/page-shell";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { FiltroKanban } from "@/components/deals/filtro-kanban";
import { TableroKanban } from "@/components/deals/tablero-kanban";
import { TONO_DE_COLUMNA } from "@/components/deals/etapa-tono";
import { NuevoDeal } from "@/components/deals/nuevo-deal";
import { DescargarDeals } from "@/components/deals/descargar-deals";
import { ETAPA_DE_ENTRADA } from "@/lib/deals/crear-a-mano";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** Las fechas que filtra la lista de deals (ticket 141), como en HubSpot. */
const CAMPOS_DE_FECHA = [
  { valor: "creado", etiqueta: "Creado" },
  { valor: "actividad", etiqueta: "Última actividad" },
  { valor: "cierre", etiqueta: "Cierre" },
  { valor: "llamada", etiqueta: "Llamada" },
  { valor: "seguimiento", etiqueta: "Próximo contacto" },
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
  const session = await paginaConRol(...ROLES_DE_OPERACION);

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();

  const busqueda = await searchParams;
  // La vista decide columnas, no cifras (ADR 0103): sin `vista` en la URL, la última de la persona.
  const tableroLeido = await tableroDeDealsParaActor(
    db,
    programa.id,
    session,
    busqueda,
    (await cookies()).get(COOKIE_VISTA_DEL_TABLERO)?.value ?? null,
  );
  const { alcance: alcanceDeals, activa, vista, filtros, tablero, opciones } = tableroLeido;
  const origen = origenDeLaPagina(`/p/${programa.slug}/deals`, busqueda);
  const tarjetas = tablero.columnas.flatMap((c) => c.tarjetas);
  const destinosDeCorreccionPorDeal = Object.fromEntries(tarjetas.map((tarjeta) => [
    tarjeta.dealId,
    destinosDeCorreccion(tarjeta.etapa).map((etapa) => ({ etapa, nombre: NOMBRE_DE_ETAPA[etapa] })),
  ]));

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Deals · tablero"
      fija
      acciones={
        <div className="flex items-center gap-2">
          <DescargarDeals
            programaSlug={programa.slug}
            etapas={ETAPAS_EN_ORDEN.map((valor) => ({ valor, nombre: NOMBRE_DE_ETAPA[valor] }))}
          />
          <NuevoDeal
            programId={programa.id}
            programaSlug={programa.slug}
            nombreEtapaDeEntrada={NOMBRE_DE_ETAPA[ETAPA_DE_ENTRADA]}
            puedeCrearLead={trabajaLeads({ rol, operaComoCloser: session.user.operaComoCloser })}
            origen={origen}
          />
        </div>
      }
    >
      <PantallaFija>
        <>
          <div className="shrink-0">
            {tablero.enProximaCohorte.length > 0 ? (
              <div className="mb-3 flex justify-end">
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/p/${programa.slug}/proxima-cohorte`} />}>
                  <span className="cifra">{tablero.enProximaCohorte.length}</span> en Próxima cohorte
                </Button>
              </div>
            ) : null}
            <FiltroKanban
              total={tablero.total}
              buscador={<BuscadorUrl placeholder="Buscar por nombre, correo o teléfono" />}
              mostrarDueno={alcanceDeals.tipo === "todos"}
              cohorteActivaId={activa?.id ?? null}
              antiguedadMinima={filtros.antiguedadMinima ?? null}
              owners={opciones.owners}
              cohortes={opciones.cohortes}
              canales={opciones.canales}
              leadQualities={opciones.leadQualities}
              leadValues={opciones.leadValues}
              orden={filtros.orden}
              fecha={filtros.fecha ?? null}
              camposDeFecha={CAMPOS_DE_FECHA}
              vista={vista}
              vistas={VISTAS_DEL_TABLERO.map((valor) => ({ valor, etiqueta: NOMBRE_DE_VISTA[valor] }))}
            />
          </div>
          <TableroKanban
            columnas={tablero.columnas}
            total={tablero.total}
            mapa={mapaDeTransiciones()}
            destinosDeCorreccion={destinosDeCorreccionPorDeal}
            nombreDeEtapa={NOMBRE_DE_ETAPA}
            nombreDeColumna={NOMBRE_DE_COLUMNA}
            nombreDePendiente={NOMBRE_DE_PENDIENTE}
            tonoDeColumna={TONO_DE_COLUMNA}
            programaSlug={programa.slug}
            cohortes={opciones.cohortes}
            cohortesDestino={opciones.cohortesDestino}
            motivos={opciones.motivos}
            plataformas={opciones.plataformas}
            enlacesDePago={opciones.enlacesDePago}
            inicioDeClases={opciones.inicioDeClases}
            inicioDeLaCohorteActiva={opciones.inicioDeLaCohorteActiva}
            userId={session.user.id}
            administra={esAdministrador(rol)}
            origen={origen}
          />
        </>
      </PantallaFija>
    </PageShell>
  );
}
