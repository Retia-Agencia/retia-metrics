import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fecha } from "@/lib/format";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { PageShell } from "@/components/page-shell";
import { DashboardPrograma } from "@/components/dashboard-programa";
import { FiltroDashboard } from "@/components/filtro-dashboard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un parametro de la URL solo sirve si vino una vez y como texto. */
function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

export default async function DashboardDelProgramaPage({ params, searchParams }: Props) {
  // La guarda corre PRIMERO, antes de mirar el slug: sin sesion redirige a login
  // aunque el programa no exista, y nunca filtra que slugs existen. El dashboard lo
  // ven gerente y closer por igual, pero el CLOSER solo en SUS programas (ADR 0048):
  // el alcance decide cuales.
  const session = await paginaConRol("gerente", "closer");

  const { programa: slug } = await params;
  // El rol de vista, no `session.user.rol` crudo (ADR 0028). El programa se resuelve
  // DENTRO del alcance de la sesion: un slug de un programa que esta sesion no ve
  // vuelve `null`, igual que uno inexistente o inactivo (ADR 0048, ticket 094).
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  // No existe, esta inactivo, o es de otro programa fuera del alcance: 404 en los
  // tres casos. `notFound()` lanza y corta el render; nunca 403, para no filtrar que
  // slugs existen.
  if (!programa) notFound();

  const busqueda = await searchParams;
  const hoy = diaDeCalendario(new Date());

  // El filtro sale de la URL, nunca de la sesion: un closer que entra sin filtro ve
  // el programa completo, igual que un gerente (ADR 0048: dentro de su programa, ve
  // todo). Si la sesion decidiera el filtro, "todos ven todo" duraria hasta el primer
  // descuido.
  const vista = await armarVistaDelDashboard({
    programId: programa.id,
    hoy,
    preset: texto(busqueda.rango) ?? "hoy",
    desde: texto(busqueda.desde),
    hasta: texto(busqueda.hasta),
    closerId: texto(busqueda.closer) ?? null,
  });

  const { desde, hasta } = vista.seleccion.rango;
  // Un solo dia se escribe una sola vez: "15 sep 2026", no "15 sep 2026 a 15 sep 2026".
  const rangoLegible = desde === hasta ? fecha(desde) : `${fecha(desde)} a ${fecha(hasta)}`;

  return (
    <PageShell
      titulo={programa.nombre}
      // La descripcion sale de la cohorte que esta en la base, no de un texto fijo:
      // un programa nuevo creado desde Ajustes describe su propia cohorte sin tocar
      // codigo (ADR 0012).
      descripcion={
        vista.cohorte
          ? `Cohorte ${vista.cohorte.codigo} · ${rangoLegible}`
          : `Sin cohorte activa · ${rangoLegible}`
      }
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
