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
import { SeccionDeTodos } from "./secciones";
import { PautaPorPrograma } from "./pauta";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardDeTodosPage({ searchParams }: Props) {
  const session = await paginaConRol("gerente", "closer");
  const rol = await rolDeVista(session);
  // Ningún parámetro de la URL decide qué programas entran a las sumas (ADR 0048).
  const programas = await programasVisibles(session.user.id, rol);
  if (programas.length === 0) notFound();
  const busqueda = await searchParams;
  const hoy = hoyEnBogota();
  const vista = await armarVistaDeTodos({ programas, hoy, periodo: parsearPeriodoUrl(busqueda) });
  const pestanas = [
    { id: "pulso", etiqueta: "Pulso", descripcion: "Contratado, caja y alertas; metas de cada programa." },
    { id: "operacion", etiqueta: "Operación", descripcion: "Actividad total y embudo de cada programa." },
    { id: "dinero", etiqueta: "Dinero", descripcion: "Lo contratado, lo cobrado por moneda y la cartera de hoy." },
    { id: "pauta", etiqueta: "Pauta", descripcion: "Origen y rendimiento de los canales dentro de cada programa." },
  ].map((pestana) => ({ ...pestana, href: urlConSeccion("/dashboard", busqueda, pestana.id) }));
  const seccion = pestanaActiva(typeof busqueda.seccion === "string" ? busqueda.seccion : undefined, pestanas, "pulso");

  return (
    <PageShell titulo="Todos los programas" descripcion="Sumas en la misma unidad; tasas y metas por programa" fija>
      <PantallaFija>
        <div className="shrink-0">
          <SelectorPeriodo periodo={vista.periodo} cohorteDisponible={false} anteriorDisponible={false} mostrarCohortes={false} />
          {vista.periodo.aviso ? <p role="status" className="text-sm text-muted-foreground">{vista.periodo.aviso}</p> : null}
        </div>
        <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del dashboard" />
        <div className={clasesDeZonaConScroll()}>
          {seccion === "pauta"
            ? <PautaPorPrograma programas={programas} periodo={vista.periodo} hoy={hoy} />
            : <SeccionDeTodos vista={vista} seccion={seccion === "operacion" || seccion === "dinero" ? seccion : "pulso"} hoy={hoy} />}
        </div>
      </PantallaFija>
    </PageShell>
  );
}
