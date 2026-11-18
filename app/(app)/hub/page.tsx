import { notFound, redirect } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { programasVisibles } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { veTableroDelPrograma } from "@/lib/auth/roles";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { hoyEnBogota } from "@/lib/format";
import { db } from "@/lib/db";
import { cargarDatosDeHub } from "@/lib/queries/hub-todos";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion } from "@/components/layout/pestanas";
import { SelectorPeriodo } from "@/components/selector-periodo";
import { BarraDeLista } from "@/components/filtros/barra-de-lista";
import { VamosALlegarVista, type PropsVamosALlegar } from "@/components/metas/vamos-a-llegar";
import type { VamosALlegar as DatosVamosALlegar } from "@/lib/queries/vamos-a-llegar";
import { SeccionDeTodos } from "./secciones";
import { ReporteDiarioVista } from "@/components/dashboard/reporte-diario";
import { SelectorDeDia } from "@/components/dashboard/selector-de-dia";
import { resolverDiaDelReporte } from "@/lib/queries/reporte-diario";
import { veEquipoComercial } from "@/lib/auth/roles";
import { PautaPorPrograma } from "./pauta";
import { queryDePautaDesdeOrigen, RUTA_HUB_TODOS } from "@/lib/nav";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { InfoDePagina } from "@/components/hub/info-de-pagina";
import { seccionesDeInfoDeHoy } from "@/components/dashboard/hoy/info-de-hoy";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HubDeTodosPage({ searchParams }: Props) {
  // Misma capacidad que el Hub de un programa: lo ven gerente, developer y paid trafficker; el closer no
  // (ADR 0082; decisión HUB-1, 30-oct). El paid trafficker ve todos SUS programas (alcance, ADR 0094) pero
  // no el trabajo del equipo comercial: las listas de closers se apagan con `veEquipoComercial`.
  const session = await paginaConCapacidad(veTableroDelPrograma);
  const rol = await rolDeVista(session);
  // Ningún parámetro de la URL decide qué programas entran a las sumas (ADR 0048).
  const programas = await programasVisibles(session.user.id, rol);
  if (programas.length === 0) notFound();
  const busqueda = await searchParams;
  // `?seccion=origen` ya no existe (412): Origen es la vista Canal de Pauta.
  const haciaPauta = queryDePautaDesdeOrigen(busqueda);
  if (haciaPauta) redirect(`${RUTA_HUB_TODOS}${haciaPauta}`);
  const hoy = hoyEnBogota();
  const pestanas = [
    { id: "hoy", etiqueta: "Hoy", descripcion: "El día de cada programa: cupos, operación, caja y lo que pide atención." },
    { id: "comercial", etiqueta: "Comercial", descripcion: "Actividad total y embudo de cada programa." },
    { id: "dinero", etiqueta: "Dinero", descripcion: "Lo vendido, lo recaudado y lo que falta por cobrar de esas ventas; lo que entró a caja, por moneda." },
    { id: "pauta", etiqueta: "Pauta", descripcion: "De dónde vienen los registros y qué rindió la plata, programa por programa." },
  ].map((pestana) => ({ ...pestana, href: urlConSeccion(RUTA_HUB_TODOS, busqueda, pestana.id) }));
  const seccion = pestanaActiva(typeof busqueda.seccion === "string" ? busqueda.seccion : undefined, pestanas, "hoy");
  // Hoy (252) es siempre de hoy, sin importar el periodo de la URL; por eso no lleva selector.
  const esHoy = seccion === "hoy";
  const origen = origenDeLaPagina(RUTA_HUB_TODOS, busqueda);
  // Hoy es el reporte diario (373): una columna por programa visible, del día de `?fecha=` (futuro = se rechaza y se avisa).
  const diaPedido = resolverDiaDelReporte(typeof busqueda.fecha === "string" ? busqueda.fecha : undefined, hoy);
  const diaDelReporte = diaPedido ?? hoy;
  // La vista de todos y los reportes de Hoy son independientes: arrancan juntos, no uno detrás del otro.
  const datos = await cargarDatosDeHub(db, {
    programas,
    hoy,
    periodo: parsearPeriodoUrl(busqueda),
    origen,
    seccion: seccion === "comercial" || seccion === "pauta" || seccion === "dinero" ? seccion : "hoy",
    diaDelReporte,
    conListas: veEquipoComercial(rol),
  });
  const { vista, reportes } = datos;

  return (
    <PageShell titulo="Todos los programas" descripcion="Sumas en la misma unidad; tasas y metas por programa" fija>
      <PantallaFija>
        {esHoy ? null : <div className="shrink-0">
          <BarraDeLista
            filtros={[]}
            marco={
              <SelectorPeriodo
                periodo={vista.periodo}
                anteriorDisponible={false}
                mostrarCohortes={false}
                variante="chip"
              />
            }
            aviso={vista.periodo.aviso ? vista.periodo.aviso : undefined}
          />
        </div>}
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del Hub" />
          </div>
          <InfoDePagina
            titulo="Hoy: qué hay y cómo se calcula"
            secciones={esHoy ? seccionesDeInfoDeHoy(reportes) : []}
          />
        </div>
        <div className={clasesDeZonaConScroll()}>
          {seccion === "pauta"
            ? <PautaPorPrograma programas={programas} periodo={vista.periodo} />
            : esHoy
            ? <>
                {diaPedido === null ? <p role="alert" className="mb-3 rounded-md border border-tono-peligro/40 px-3 py-2 text-sm text-tono-peligro">Esa fecha no es válida (no puede ser futura): se muestra hoy.</p> : null}
                <ReporteDiarioVista
                  programas={reportes}
                  dia={diaDelReporte}
                  hoy={hoy}
                  veEquipo={veEquipoComercial(rol)}
                  selector={<SelectorDeDia dia={diaDelReporte} hoy={hoy} base={{ path: RUTA_HUB_TODOS, params: {} }} />}
                  vamosALlegar={<div className={`grid gap-4 ${programas.length > 1 ? "xl:grid-cols-2 print:grid-cols-1" : ""}`}>
                    {programas.map((programa) => (
                      <VamosALlegarVistaDe key={programa.id} datos={datos.vamosALlegar.get(programa.id)} props={{ conNombre: true, programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre }, hoy: diaDelReporte, origen, conListas: veEquipoComercial(rol), configurar: null }} />
                    ))}
                  </div>}
                />
              </>
            : <SeccionDeTodos vista={vista} seccion={seccion === "comercial" || seccion === "dinero" ? seccion : "hoy"} hoy={hoy} origen={origen} comercial={datos.comercial} />}
          {/* El norte (371): una matriz por programa, lado a lado y nunca sumada (ADR 0048); no lee el periodo. */}
          {esHoy ? null : <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {programas.map((programa) => (
              <VamosALlegarVistaDe key={programa.id} datos={datos.vamosALlegar.get(programa.id)} props={{ conNombre: true, programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre }, hoy: hoy, origen, conListas: veEquipoComercial(rol), configurar: null }} />
            ))}
          </div>}
        </div>
      </PantallaFija>
    </PageShell>
  );
}

/** Un programa sin su lectura (no debería pasar: el cargador lee uno por programa) no se dibuja. */
function VamosALlegarVistaDe({ datos, props }: { datos: DatosVamosALlegar | undefined; props: PropsVamosALlegar }) {
  return datos ? <VamosALlegarVista datos={datos} props={props} /> : null;
}
