import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { programaActivoPorSlug, programasActivos } from "@/lib/queries/programas";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { PageShell } from "@/components/page-shell";
import { ProgramSwitcher } from "@/components/program-switcher";
import { DashboardPrograma } from "@/components/dashboard-programa";
import { FiltroDashboard } from "@/components/filtro-dashboard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un parametro de la URL solo sirve si vino una vez y como texto. */
function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

export default async function ProgramaPage({ params, searchParams }: Props) {
  // La guarda corre PRIMERO, antes de mirar el slug: sin sesion redirige a login
  // aunque el programa no exista, y nunca filtra que slugs existen. El dashboard
  // lo ven gerente y closer por igual (ADR 0009).
  await paginaConRol("gerente", "closer");

  const { slug } = await params;
  const programa = await programaActivoPorSlug(slug);
  // No existe o esta inactivo: 404. `notFound()` lanza y corta el render.
  if (!programa) notFound();

  const busqueda = await searchParams;
  const hoy = diaDeCalendario(new Date());

  // El filtro sale de la URL, nunca de la sesion: un closer que entra sin filtro ve
  // el programa completo, igual que un gerente. Si la sesion decidiera el filtro,
  // "todos ven todo" duraria hasta el primer descuido.
  const vista = await armarVistaDelDashboard({
    programId: programa.id,
    hoy,
    preset: texto(busqueda.rango) ?? "hoy",
    desde: texto(busqueda.desde),
    hasta: texto(busqueda.hasta),
    closerId: texto(busqueda.closer) ?? null,
  });

  const programas = await programasActivos();
  const { desde, hasta } = vista.seleccion.rango;

  return (
    <PageShell
      titulo={programa.nombre}
      // La descripcion sale de la cohorte que esta en la base, no de un texto fijo:
      // un programa nuevo creado desde Ajustes describe su propia cohorte sin tocar
      // codigo (ADR 0012).
      descripcion={
        vista.cohorte
          ? `Cohorte ${vista.cohorte.codigo} · ${desde} a ${hasta}`
          : `Sin cohorte activa · ${desde} a ${hasta}`
      }
      acciones={<ProgramSwitcher programas={programas} />}
    >
      <div className="space-y-6">
        <FiltroDashboard
          preset={vista.seleccion.preset}
          desde={desde}
          hasta={hasta}
          closerId={vista.closerId}
          closers={vista.closers}
          cohorteDisponible={vista.cohorte?.ventana != null}
        />
        <DashboardPrograma vista={vista} />
      </div>
    </PageShell>
  );
}
