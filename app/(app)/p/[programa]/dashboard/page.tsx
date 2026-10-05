import { alertasDelPrograma } from "@/lib/queries/alertas";
import { detallesDeOperacion, detallesDelDashboard, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { fecha, num, hoyEnBogota } from "@/lib/format";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { embudoPorCanal, nombresDeCanales } from "@/lib/queries/dashboard";
import { pautaInterina, type FiltrosPauta } from "@/lib/queries/pauta-interina";
import { hechosDelEmbudo } from "@/lib/queries/hechos-embudo";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { registrosYAgendasPorCanal } from "@/lib/queries/registros-agendas-canal";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion, type Pestana } from "@/components/layout/pestanas";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { DashboardPrograma, OrigenPorCanal } from "@/components/dashboard-programa";
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

// El filtro de closer de la URL es un `users.id` (ticket 167, Decision 5): un valor
// que no es uuid se ignora (no filtra), igual que el filtro de area.
const esquemaFiltroCloser = z.string().uuid().optional().catch(undefined);

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

  // Las secciones del 148 pasan a pestañas (ticket 197): el dashboard es una pantalla fija
  // y cada sección vive en su `?seccion=`. El orden y las líneas los afina Mani al revisar.
  const base = `/p/${programa.slug}/dashboard`;
  const pestanas: Pestana[] = [
    {
      id: "pulso",
      etiqueta: "Pulso",
      descripcion: "Cómo va el mes: meta, ventas, caja y lo que pide atención.",
      href: urlConSeccion(base, busqueda, "pulso"),
    },
    {
      id: "operacion",
      etiqueta: "Operación",
      descripcion: "El embudo, las llamadas y el trabajo de cada closer.",
      href: urlConSeccion(base, busqueda, "operacion"),
    },
    {
      id: "dinero",
      etiqueta: "Dinero",
      descripcion: "Lo contratado, lo cobrado y lo que falta por cobrar.",
      href: urlConSeccion(base, busqueda, "dinero"),
    },
    {
      id: "pauta",
      etiqueta: "Pauta",
      descripcion: "De dónde vienen los leads y cuánto cuesta cada uno.",
      href: urlConSeccion(base, busqueda, "pauta"),
    },
  ];
  const seccion = pestanaActiva(texto(busqueda.seccion), pestanas, "pulso");

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
    claveCloser: esquemaFiltroCloser.parse(texto(busqueda.closer)) ?? null,
  });

  // Cada cifra abre su lista y su "Volver" regresa a ESTA pestaña con ESTE filtro: el
  // origen (path + query, con `seccion`) viaja como parámetro `desde` en el href de cada lista
  // (ticket 174, 197), SOLO por `enlaceConVuelta` dentro de `detalleDeCifra`.
  const origen = origenDeLaPagina(base, busqueda);

  // Solo se calcula lo de la pestaña activa (ticket 197 §5): a esta escala el ahorro no
  // importa, pero cada bloque es una consulta que no vale la pena correr fuera de su
  // pestaña. `armarVistaDelDashboard` sí calcula todo junto y se deja así.
  const necesitaDetalles = seccion === "pulso" || seccion === "operacion" || seccion === "dinero";
  const detalles: DetallesDelDashboard | undefined = necesitaDetalles
    ? await detallesDelDashboard({
        programId: programa.id,
        slug,
        hoy,
        periodo: vista.periodo,
        claveCloser: vista.claveCloser,
        origen,
      })
    : undefined;

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
      fija
    >
      <PantallaFija>
        <div className="shrink-0">
          <FiltroDashboard
            periodo={vista.periodo}
            anteriorDisponible={vista.anteriorDisponible}
            claveCloser={vista.claveCloser}
            closers={vista.closers}
            cohorteDisponible={vista.cohorte?.ventana != null}
          />
        </div>
        <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del dashboard" />

        <div className={clasesDeZonaConScroll()}>
          {seccion === "pauta" ? (
            <SeccionPauta
              programId={programa.id}
              rango={vista.seleccion.rango}
              hoy={hoy}
              claveCloser={vista.claveCloser}
              busqueda={busqueda}
            />
          ) : seccion === "operacion" ? (
            <DashboardPrograma
              seccion="operacion"
              vista={vista}
              detalles={detalles}
              detallesOperacion={await detallesDeOperacion(
                { programId: programa.id, slug, hoy, periodo: vista.periodo, origen },
                vista.comparativo.map((fila) => fila.clave),
              )}
              slug={slug}
              dealsContraAgendas={
                <DealsContraAgendas
                  vista={await vistaDealsContraAgendas({
                    programId: programa.id,
                    slug,
                    hoy,
                    periodo: vista.periodo,
                    claveCloser: vista.claveCloser,
                  })}
                />
              }
            />
          ) : (
            <DashboardPrograma
              seccion={seccion === "dinero" ? "dinero" : "pulso"}
              vista={vista}
              detalles={detalles}
              slug={slug}
              // El embudo contra agendas es de Operación; fuera de esa pestaña no se arma.
              dealsContraAgendas={null}
              origen={origen}
              alertas={seccion === "pulso" ? await alertasDelPrograma(programa.id, hoy) : undefined}
              seriesDinero={seccion === "dinero" ? await leerSeriesDeDinero({
                programId: programa.id,
                rango: vista.periodo.a,
                claveCloser: vista.claveCloser,
                hoy,
              }) : undefined}
            />
          )}
        </div>
      </PantallaFija>
    </PageShell>
  );
}

/**
 * La pestaña "Pauta y origen (interina)" (093): de dónde vienen los leads y cuánto cuesta
 * cada uno. Sus consultas son exclusivas de esta pestaña, así que solo corren cuando está
 * activa (ticket 197 §5). El link de profundizar conserva el rango y el closer y reemplaza
 * solo los filtros de UTM.
 */
async function SeccionPauta({
  programId,
  rango,
  hoy,
  claveCloser,
  busqueda,
}: {
  programId: string;
  rango: { desde: string; hasta: string };
  hoy: string;
  claveCloser: string | null;
  busqueda: Record<string, string | string[] | undefined>;
}) {
  const filtrosPauta: FiltrosPauta = esquemaFiltrosPauta.parse({
    source: texto(busqueda.source),
    medium: texto(busqueda.medium),
    campaign: texto(busqueda.campaign),
  });
  const pauta = await pautaInterina(db, programId, rango, filtrosPauta, hoy);
  const areaId = esquemaFiltroArea.parse(texto(busqueda.area));
  const hechos = await hechosDelEmbudo(db, { programId, rango });
  const embudoFormulario = await embudoDelFormulario(db, { programId, rango });
  const porCanal = await registrosYAgendasPorCanal(db, programId, rango, hoy);
  const hechosFiltrados = areaId === undefined ? hechos : hechos.filter((fila) => fila.areaId === areaId);
  // Con un closer en el filtro el bloque Origen por canal no se muestra (129).
  const origenPorCanal = claveCloser ? null : embudoPorCanal(hechosFiltrados, await nombresDeCanales(db));
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

  return (
    <section className="space-y-4">
      <PautaInterina vista={pauta} filtros={filtrosPauta} hrefCon={hrefConFiltros} />
      <OrigenPorCanal filas={origenPorCanal} />
      <RegistrosAgendasCanal vista={porCanal} />
      <EmbudoFormulario embudo={embudoFormulario} />
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
    </section>
  );
}
