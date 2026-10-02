import { detallesDelDashboard } from "@/lib/queries/vista-metrica";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { fecha, num, hoyEnBogota } from "@/lib/format";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { embudoPorCanal, nombresDeCanales } from "@/lib/queries/dashboard";
import { pautaInterina, type FiltrosPauta } from "@/lib/queries/pauta-interina";
import { hechosDelEmbudo } from "@/lib/queries/hechos-embudo";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { registrosYAgendasPorCanal } from "@/lib/queries/registros-agendas-canal";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { DashboardPrograma } from "@/components/dashboard-programa";
import { FiltroDashboard } from "@/components/filtro-dashboard";
import { PautaInterina } from "@/components/pauta-interina";
import { EmbudoFormulario } from "@/components/embudo-formulario";
import { RegistrosAgendasCanal } from "@/components/registros-agendas-canal";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Los filtros de UTM de la vista interina de Pauta (093). Un valor que no cuadra se ignora en
 * vez de romper la pagina: es un filtro de lectura, no una escritura.
 */
const esquemaFiltrosPauta = z.object({
  source: z.string().trim().min(1).max(200).optional().catch(undefined),
  medium: z.string().trim().min(1).max(200).optional().catch(undefined),
  campaign: z.string().trim().min(1).max(300).optional().catch(undefined),
});

const esquemaFiltroArea = z.string().uuid().optional().catch(undefined);

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
  const hoy = hoyEnBogota();

  // El filtro sale de la URL, nunca de la sesion: un closer que entra sin filtro ve
  // el programa completo, igual que un gerente (ADR 0048: dentro de su programa, ve
  // todo). Si la sesion decidiera el filtro, "todos ven todo" duraria hasta el primer
  // descuido.
  const vista = await armarVistaDelDashboard({
    programId: programa.id,
    hoy,
    periodo: parsearPeriodoUrl(busqueda),
    preset: texto(busqueda.rango) ?? "hoy",
    desde: texto(busqueda.desde),
    hasta: texto(busqueda.hasta),
    closerId: texto(busqueda.closer) ?? null,
  });

  const detalles = await detallesDelDashboard({
    programId: programa.id,
    slug,
    hoy,
    periodo: vista.periodo,
    closerId: vista.closerId,
  });
  const dealsContraAgendas = await vistaDealsContraAgendas({
    programId: programa.id,
    slug,
    hoy,
    periodo: vista.periodo,
    closerId: vista.closerId,
  });
  const { desde, hasta } = vista.seleccion.rango;

  const filtrosPauta: FiltrosPauta = esquemaFiltrosPauta.parse({
    source: texto(busqueda.source),
    medium: texto(busqueda.medium),
    campaign: texto(busqueda.campaign),
  });
  const pauta = await pautaInterina(db, programa.id, vista.seleccion.rango, filtrosPauta, hoy);
  const areaId = esquemaFiltroArea.parse(texto(busqueda.area));
  const hechos = await hechosDelEmbudo(db, {
    programId: programa.id,
    rango: vista.seleccion.rango,
  });
  const embudoFormulario = await embudoDelFormulario(db, {
    programId: programa.id,
    rango: vista.seleccion.rango,
  });
  const porCanal = await registrosYAgendasPorCanal(db, programa.id, vista.seleccion.rango, hoy);
  const hechosFiltrados = areaId === undefined ? hechos : hechos.filter((fila) => fila.areaId === areaId);
  // Con un closer en el filtro el bloque Origen por canal no se muestra (129).
  const origenPorCanal = vista.closerId
    ? null
    : embudoPorCanal(hechosFiltrados, await nombresDeCanales(db));
  const resumenSerie = hechosFiltrados.reduce(
    (total, fila) => ({
      envios: total.envios + fila.envios,
      agendas: total.agendas + fila.agendas,
      shows: total.shows + fila.shows,
      ventas: total.ventas + fila.ventas,
    }),
    { envios: 0, agendas: 0, shows: 0, ventas: 0 },
  );
  // El link de profundizar conserva el rango y el closer, y reemplaza solo los filtros de UTM.
  const hrefConFiltros = (f: FiltrosPauta) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(busqueda)) {
      if (typeof v === "string" && !["source", "medium", "campaign"].includes(k)) q.set(k, v);
    }
    for (const [k, v] of Object.entries(f)) if (v !== undefined) q.set(k, v);
    const query = q.toString();
    return query ? `?${query}` : "?";
  };
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
          periodo={vista.periodo}
          anteriorDisponible={vista.anteriorDisponible}
          closerId={vista.closerId}
          closers={vista.closers}
          cohorteDisponible={vista.cohorte?.ventana != null}
        />
        <DashboardPrograma vista={vista} detalles={detalles} origenPorCanal={origenPorCanal} />
        <DealsContraAgendas vista={dealsContraAgendas} />
        <Card aria-labelledby="resumen-serie">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle id="resumen-serie">Serie del embudo</CardTitle>
              {areaId !== undefined ? <Badge variant="info">Área filtrada</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries({
              Envíos: resumenSerie.envios,
              Agendas: resumenSerie.agendas,
              Shows: resumenSerie.shows,
              Ventas: resumenSerie.ventas,
            }).map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <p className="text-sm text-muted-foreground">{etiqueta}</p>
                <p className="cifra text-lg font-semibold">{num(valor)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <PautaInterina vista={pauta} filtros={filtrosPauta} hrefCon={hrefConFiltros} />
        <RegistrosAgendasCanal vista={porCanal} />
        <EmbudoFormulario embudo={embudoFormulario} />
      </div>
    </PageShell>
  );
}
