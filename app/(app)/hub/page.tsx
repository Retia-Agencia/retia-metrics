import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { programasVisibles } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { hoyEnBogota } from "@/lib/format";
import { armarVistaDeTodos } from "@/lib/queries/vista-todos";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion } from "@/components/layout/pestanas";
import { SelectorPeriodo } from "@/components/selector-periodo";
import { BarraDeLista } from "@/components/filtros/barra-de-lista";
import { SeccionDeTodos } from "./secciones";
import { OrigenPorPrograma, PautaPorPrograma } from "./pauta";
import { RUTA_HUB_TODOS } from "@/lib/nav";
import { origenDeLaPagina } from "@/lib/navegacion/volver";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HubDeTodosPage({ searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const rol = await rolDeVista(session);
  // Ningún parámetro de la URL decide qué programas entran a las sumas (ADR 0048).
  const programas = await programasVisibles(session.user.id, rol);
  if (programas.length === 0) notFound();
  const busqueda = await searchParams;
  const hoy = hoyEnBogota();
  const pestanas = [
    { id: "hoy", etiqueta: "Hoy", descripcion: "El día de cada programa: cupos, operación, caja y lo que pide atención." },
    { id: "comercial", etiqueta: "Comercial", descripcion: "Actividad total y embudo de cada programa." },
    { id: "dinero", etiqueta: "Dinero", descripcion: "Lo contratado, lo cobrado por moneda y la cartera de hoy." },
    { id: "pauta", etiqueta: "Pauta", descripcion: "Origen y rendimiento de los canales dentro de cada programa." },
    { id: "origen", etiqueta: "Origen", descripcion: "De dónde vino cada lead y cómo cuenta cada UTM." },
  ].map((pestana) => ({ ...pestana, href: urlConSeccion(RUTA_HUB_TODOS, busqueda, pestana.id) }));
  const seccion = pestanaActiva(typeof busqueda.seccion === "string" ? busqueda.seccion : undefined, pestanas, "hoy");
  // Hoy (252) es siempre de hoy, sin importar el periodo de la URL; por eso no lleva selector.
  const esHoy = seccion === "hoy";
  const origen = origenDeLaPagina(RUTA_HUB_TODOS, busqueda);
  const vista = await armarVistaDeTodos({ programas, hoy, periodo: esHoy ? { preset: "hoy" } : parsearPeriodoUrl(busqueda), origen });

  return (
    <PageShell titulo="Todos los programas" descripcion="Sumas en la misma unidad; tasas y metas por programa" fija>
      <PantallaFija>
        {esHoy ? null : <div className="shrink-0">
          <BarraDeLista
            filtros={[]}
            marco={
              <SelectorPeriodo
                periodo={vista.periodo}
                cohorteDisponible={false}
                anteriorDisponible={false}
                mostrarCohortes={false}
                variante="chip"
              />
            }
            aviso={vista.periodo.aviso ? vista.periodo.aviso : undefined}
          />
        </div>}
        <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del Hub" />
        <div className={clasesDeZonaConScroll()}>
          {seccion === "origen"
            ? <OrigenPorPrograma programas={programas} periodo={vista.periodo} hoy={hoy} origen={origen} />
            : seccion === "pauta"
            ? <PautaPorPrograma programas={programas} periodo={vista.periodo} hoy={hoy} />
            : <SeccionDeTodos vista={vista} seccion={seccion === "comercial" || seccion === "dinero" ? seccion : "hoy"} hoy={hoy} origen={origen} />}
        </div>
      </PantallaFija>
    </PageShell>
  );
}
