import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { NOMBRE_DE_COLUMNA, NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE, NOMBRE_DE_VISTA, VISTAS_DEL_TABLERO } from "@/lib/deals/etapas";
import { COOKIE_VISTA_DEL_TABLERO } from "@/lib/deals/vista-recordada";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { opcionesDeTablero, parsearFiltros, tableroKanban, vistaDelTablero, type CampoDeFechaDeDeal } from "@/lib/queries/kanban";
import { PageShell } from "@/components/page-shell";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { FiltroKanban } from "@/components/deals/filtro-kanban";
import { correccionSerializable } from "@/lib/deals/mapa-transiciones";
import { destinosDeCorreccion } from "@/lib/deals/mover-etapa";
import { TableroKanban } from "@/components/deals/tablero-kanban";
import { TONO_DE_COLUMNA } from "@/components/deals/etapa-tono";
import { NuevoDeal } from "@/components/deals/nuevo-deal";
import { ETAPA_DE_ENTRADA } from "@/lib/deals/crear-a-mano";
import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { PantallaFija } from "@/components/layout/pantalla-fija";
import { BusquedaDeDeals } from "@/components/deals/busqueda-de-deals";
import { BuscadorDeDeals } from "@/components/deals/buscador-de-deals";
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
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();

  const alcanceDeals = await alcanceDeDeals(session);
  const busqueda = await searchParams;
  const activa = await cohorteActiva(programa.id, db);
  // La vista decide columnas, no cifras (ADR 0103): sin `vista` en la URL, la última de la persona.
  const vista = vistaDelTablero(busqueda, (await cookies()).get(COOKIE_VISTA_DEL_TABLERO)?.value ?? null);
  const filtros = { ...parsearFiltros(busqueda, undefined, activa?.id ?? null), vista };
  const origen = origenDeLaPagina(`/p/${programa.slug}/deals`, busqueda);
  const [tablero, opciones] = await Promise.all([
    tableroKanban(db, programa.id, alcanceDeals, filtros),
    opcionesDeTablero(db, programa.id),
  ]);
  const tarjetas = tablero.columnas.flatMap((c) => c.tarjetas);
  const destinos = await destinosDeCorreccion(db, tarjetas);
  const correcciones = Object.fromEntries(
    tarjetas.flatMap((t) => {
      const correccion = correccionSerializable(t.etapa, destinos[t.dealId] ?? null);
      return correccion ? [[t.dealId, correccion] as const] : [];
    }),
  );

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Deals · tablero"
      fija
      acciones={
        <NuevoDeal
          programId={programa.id}
          programaSlug={programa.slug}
          nombreEtapaDeEntrada={NOMBRE_DE_ETAPA[ETAPA_DE_ENTRADA]}
          puedeCrearLead={trabajaLeads({ rol, operaComoCloser: session.user.operaComoCloser })}
          origen={origen}
        />
      }
    >
      <PantallaFija>
        <BusquedaDeDeals key={programa.id}>
          <div className="shrink-0">
            {tablero.enProximaCohorte > 0 ? (
              <div className="mb-3 flex justify-end">
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/p/${programa.slug}/proxima-cohorte`} />}>
                  <span className="cifra">{tablero.enProximaCohorte}</span> en Próxima cohorte
                </Button>
              </div>
            ) : null}
            <FiltroKanban
              total={tablero.total}
              buscador={<BuscadorDeDeals programaSlug={programa.slug} idsDelTablero={tarjetas.map((t) => t.dealId)} />}
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
            correcciones={correcciones}
            nombreDeEtapa={NOMBRE_DE_ETAPA}
            nombreDeColumna={NOMBRE_DE_COLUMNA}
            nombreDePendiente={NOMBRE_DE_PENDIENTE}
            tonoDeColumna={TONO_DE_COLUMNA}
            programaSlug={programa.slug}
            cohortes={opciones.cohortes}
            cohortesDestino={opciones.cohortesDestino}
            motivos={opciones.motivos}
            plataformas={opciones.plataformas}
            inicioDeClases={opciones.inicioDeClases}
            inicioDeLaCohorteActiva={opciones.inicioDeLaCohorteActiva}
            userId={session.user.id}
            administra={esAdministrador(rol)}
            origen={origen}
          />
        </BusquedaDeDeals>
      </PantallaFija>
    </PageShell>
  );
}
