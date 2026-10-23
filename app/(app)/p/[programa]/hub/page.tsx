import Link from "next/link";
import { after } from "next/server";
import { desc } from "drizzle-orm";
import { alertasDelPrograma } from "@/lib/queries/alertas";
import { leerMetasDelMes, moverMes, nombreDelMes } from "@/lib/queries/metas";
import { MetasDelMes } from "@/components/metas/metas-del-mes";
import { OrigenPendiente } from "@/components/dashboard/origen-pendiente";
import { Hoy } from "@/components/dashboard/hoy";
import { armarVistaDeHoy } from "@/lib/queries/vista-hoy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rutaDePrograma, type SeccionDelHub } from "@/lib/nav";
import { detalleDeCifra, detallesDeOperacion, detallesDelDashboard, sinListas, urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { parsearPeriodoUrl, type PeriodoResuelto } from "@/lib/periodo";
import { fecha, num, hoyEnBogota } from "@/lib/format";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { embudoPorCanal } from "@/lib/queries/dashboard";
import { AREAS } from "@/lib/atribucion/canal";
import { pautaInterina, type FiltrosPauta } from "@/lib/queries/pauta-interina";
import { hechosDelEmbudo } from "@/lib/queries/hechos-embudo";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { embudoPorPregunta } from "@/lib/queries/embudo-por-pregunta";
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
import { EmbudoPorPregunta } from "@/components/embudo-por-pregunta";
import { RegistrosAgendasCanal } from "@/components/registros-agendas-canal";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SemaforoDelPrograma } from "@/components/semaforo/semaforo-del-programa";
import { pautaSincronizaciones } from "@/lib/db/schema";
import { tokensMeta } from "@/lib/integraciones";
import {
  debeSincronizarDesdeElHub,
  sincronizarDiaEnCurso,
} from "@/lib/pauta/dia-en-curso";

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

const esquemaFiltroArea = z.enum(AREAS).optional().catch(undefined);

// El filtro de closer de la URL es un `users.id` (ticket 167, Decision 5): un valor
// que no es uuid se ignora (no filtra), igual que el filtro de area.
const esquemaFiltroCloser = z.string().uuid().optional().catch(undefined);

/** Un parametro de la URL solo sirve si vino una vez y como texto. */
function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

export default async function HubDelProgramaPage({ params, searchParams }: Props) {
  // La guarda corre PRIMERO, antes de mirar el slug: sin sesion redirige a login
  // aunque el programa no exista. El tablero lo ven gerente, developer y el paid trafficker
  // (ADR 0052, ticket 102); el closer ya NO (ticket 224, ADR 0082) y la ruta le responde 404
  // —`paginaConCapacidad` con `veTableroDelPrograma`, por capacidad, nunca `rol === "..."`—.
  // Cada rol solo en SUS programas (ADR 0048): el alcance decide cuales.
  const session = await paginaConCapacidad(veTableroDelPrograma);

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
  // Sin equipo (paid trafficker): ni comparativo, ni comisión, ni filtro de closer, ni la
  // lista detrás de una cifra. Se decide aquí, en el servidor, y se proyecta antes de pintar.
  const veEquipo = veEquipoComercial(rol);
  const proyectar = <T,>(valor: T): T => (veEquipo ? valor : sinListas(valor));

  const busqueda = await searchParams;
  const hoy = hoyEnBogota();

  // El Hub (ADR 0086, ticket 250): una pantalla fija con cinco pestañas en `?seccion=`, en
  // este orden. Hoy junta lo que eran Pulso y Metas (el 252 lo rearma como reporte diario);
  // Comercial es la Operación de antes; Pauta guarda la vista interina hasta que el 248 la
  // reparta con Origen.
  const base = rutaDePrograma(programa.slug, "hub");
  const pestanas: Pestana[] = [
    {
      id: "hoy",
      etiqueta: "Hoy",
      descripcion: "¿Vamos a llegar? Meta del mes, ventas, caja y lo que pide atención.",
      href: urlConSeccion(base, busqueda, "hoy"),
    },
    {
      id: "comercial",
      etiqueta: "Comercial",
      descripcion: "El embudo, las llamadas y el trabajo de cada closer.",
      href: urlConSeccion(base, busqueda, "comercial"),
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
    {
      id: "origen",
      etiqueta: "Origen",
      descripcion: "De dónde vino cada lead y cómo cuenta cada UTM.",
      href: urlConSeccion(base, busqueda, "origen"),
    },
  ] satisfies (Pestana & { id: SeccionDelHub })[];
  const seccion = pestanaActiva(texto(busqueda.seccion), pestanas, "hoy");

  // El filtro sale de la URL, nunca de la sesion: un closer que entra sin filtro ve
  // el programa completo, igual que un gerente (ADR 0048: dentro de su programa, ve
  // todo). Si la sesion decidiera el filtro, "todos ven todo" duraria hasta el primer
  // descuido.
  //
  // Hoy (252) es el reporte del día: se arma SIEMPRE con el día de hoy y el programa entero, sin
  // importar el periodo ni el closer de la URL, y por eso no muestra el selector. Es la misma
  // consulta que las demás pestañas con el periodo "hoy": no se recalcula nada.
  const esHoy = seccion === "hoy";
  const vistaDeHoy = esHoy ? await armarVistaDeHoy({ programId: programa.id, dia: hoy }) : null;
  const vista = vistaDeHoy?.vista ?? await armarVistaDelDashboard({
        programId: programa.id,
        hoy,
        periodo: parsearPeriodoUrl(busqueda),
        preset: texto(busqueda.rango) ?? "hoy",
        desde: texto(busqueda.desde),
        hasta: texto(busqueda.hasta),
        claveCloser: veEquipo ? esquemaFiltroCloser.parse(texto(busqueda.closer)) ?? null : null,
      });

  // Cada cifra abre su lista y su "Volver" regresa a ESTA pestaña con ESTE filtro: el
  // origen (path + query, con `seccion`) viaja como parámetro `desde` en el href de cada lista
  // (ticket 174, 197), SOLO por `enlaceConVuelta` dentro de `detalleDeCifra`.
  const origen = origenDeLaPagina(base, busqueda);

  // Solo se calcula lo de la pestaña activa (ticket 197 §5): a esta escala el ahorro no
  // importa, pero cada bloque es una consulta que no vale la pena correr fuera de su
  // pestaña. `armarVistaDelDashboard` sí calcula todo junto y se deja así.
  const necesitaDetalles = seccion === "hoy" || seccion === "comercial" || seccion === "dinero";
  const detalles: DetallesDelDashboard | undefined = necesitaDetalles
    ? proyectar(await detallesDelDashboard({
        programId: programa.id,
        slug,
        hoy,
        periodo: vista.periodo,
        claveCloser: vista.claveCloser,
        origen,
      }))
    : undefined;
  const detalleAgendasCreadas = esHoy
    ? proyectar(await detalleDeCifra("agendas_creadas", {
        programId: programa.id,
        slug,
        hoy,
        periodo: vista.periodo,
        claveCloser: vista.claveCloser,
        origen,
      }))
    : undefined;
  const detalleRegistros = esHoy
    ? proyectar(await detalleDeCifra("registros", {
        programId: programa.id,
        slug,
        hoy,
        periodo: vista.periodo,
        claveCloser: vista.claveCloser,
        origen,
      }))
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
        {esHoy ? null : (
          <div className="shrink-0">
            <FiltroDashboard
              periodo={vista.periodo}
              anteriorDisponible={vista.anteriorDisponible}
              claveCloser={vista.claveCloser}
              closers={veEquipo ? vista.closers : []}
              filtraCloser={veEquipo}
              cohorteDisponible={vista.cohorte?.ventana != null}
            />
          </div>
        )}
        <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del Hub" />

        <div className={clasesDeZonaConScroll()}>
          {seccion === "origen" ? (
            <OrigenPendiente hrefPauta={urlConSeccion(base, busqueda, "pauta")} />
          ) : seccion === "pauta" ? (
            <SeccionPauta
              programId={programa.id}
              rango={vista.seleccion.rango}
              hoy={hoy}
              claveCloser={vista.claveCloser}
              busqueda={busqueda}
            />
          ) : seccion === "comercial" ? (
            <DashboardPrograma
              seccion="operacion"
              vista={vista}
              detalles={detalles}
              detallesOperacion={proyectar(await detallesDeOperacion(
                { programId: programa.id, slug, hoy, periodo: vista.periodo, origen },
                vista.comparativo.map((fila) => fila.clave),
              ))}
              slug={slug}
              veEquipo={veEquipo}
              dealsContraAgendas={
                <DealsContraAgendas
                  vista={proyectar(await vistaDealsContraAgendas({
                    programId: programa.id,
                    slug,
                    hoy,
                    periodo: vista.periodo,
                    claveCloser: vista.claveCloser,
                  }))}
                />
              }
            />
          ) : seccion === "dinero" ? (
            <DashboardPrograma
              seccion="dinero"
              vista={vista}
              detalles={detalles}
              slug={slug}
              // El embudo contra agendas es de Comercial; fuera de esa pestaña no se arma.
              dealsContraAgendas={null}
              origen={origen}
              veEquipo={veEquipo}
              seriesDinero={await leerSeriesDeDinero({
                programId: programa.id,
                rango: vista.periodo.a,
                claveCloser: vista.claveCloser,
                hoy,
              })}
            />
          ) : (
            <Hoy
              vista={vista}
              contexto={vistaDeHoy!.contexto}
              horizontes={vistaDeHoy!.horizontes}
              caja={vistaDeHoy!.caja}
              registros={vistaDeHoy!.registros}
              detalleRegistros={detalleRegistros}
              agendasCreadas={vistaDeHoy!.agendasCreadas}
              detalleAgendasCreadas={detalleAgendasCreadas}
              detalles={detalles}
              detallesOperacion={veEquipo ? await detallesDeOperacion(
                { programId: programa.id, slug, hoy, periodo: vista.periodo, origen },
                vista.comparativo.map((fila) => fila.clave),
              ) : undefined}
              alertas={await alertasDelPrograma(programa.id, hoy)}
              slug={slug}
              veEquipo={veEquipo}
              // Lo que era la página Metas (ADR 0086 punto 1). Sus listas son del equipo comercial:
              // sin él (paid trafficker) las cifras salen como texto.
              metas={<SeccionMetas programId={programa.id} slug={slug} hoy={hoy} busqueda={busqueda} conListas={veEquipo} />}
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
  const ahora = new Date();
  const [ultimaSincronizacion] = await db
    .select({ inicio: pautaSincronizaciones.inicio })
    .from(pautaSincronizaciones)
    .orderBy(desc(pautaSincronizaciones.inicio))
    .limit(1);
  if (debeSincronizarDesdeElHub(ultimaSincronizacion?.inicio ?? null, ahora)) {
    after(async () => {
      try {
        const resultado = await sincronizarDiaEnCurso(db, {
          tokens: await tokensMeta(db),
          ahora,
          disparadaPor: "hub",
        });
        if (resultado.estado === "error") {
          console.error("hub pauta: no se pudo sincronizar el dia en curso", resultado.error);
        }
      } catch (error) {
        console.error("hub pauta: no se pudo sincronizar el dia en curso", error);
      }
    });
  }
  const filtrosPauta: FiltrosPauta = esquemaFiltrosPauta.parse({
    source: texto(busqueda.source),
    medium: texto(busqueda.medium),
    campaign: texto(busqueda.campaign),
  });
  // El Insights de Typeform (126 B) puede tardar hasta su timeout: va en paralelo, no en serie.
  const porPreguntaPendiente = embudoPorPregunta(db, programId);
  const pauta = await pautaInterina(db, programId, rango, filtrosPauta, hoy);
  const area = esquemaFiltroArea.parse(texto(busqueda.area));
  const hechos = await hechosDelEmbudo(db, { programId, rango });
  const embudoFormulario = await embudoDelFormulario(db, { programId, rango });
  const porPregunta = await porPreguntaPendiente;
  const porCanal = await registrosYAgendasPorCanal(db, programId, rango, hoy);
  const hechosFiltrados = area === undefined ? hechos : hechos.filter((fila) => fila.area === area);
  // Con un closer en el filtro el bloque Origen por canal no se muestra (129).
  const origenPorCanal = claveCloser ? null : embudoPorCanal(hechosFiltrados);
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
      <SemaforoDelPrograma programId={programId} />
      <PautaInterina vista={pauta} filtros={filtrosPauta} hrefCon={hrefConFiltros} />
      <OrigenPorCanal filas={origenPorCanal} />
      <RegistrosAgendasCanal vista={porCanal} />
      <EmbudoFormulario embudo={embudoFormulario} />
      <EmbudoPorPregunta embudos={porPregunta} />
      <Card aria-labelledby="resumen-serie">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle id="resumen-serie">Serie del embudo</CardTitle>
            {area !== undefined ? <Badge variant="info">Área filtrada</Badge> : null}
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

const esquemaMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/**
 * Las metas del mes, que eran la página Metas (ticket 146) y desde el 250 viven en Hoy. El mes
 * sale de `?mes=` y se mueve con sus flechas sin soltar el resto de la URL (periodo, closer).
 */
async function SeccionMetas({
  programId,
  slug,
  hoy,
  busqueda,
  conListas,
}: {
  programId: string;
  slug: string;
  hoy: string;
  busqueda: Record<string, string | string[] | undefined>;
  conListas: boolean;
}) {
  const mes = esquemaMes.catch(hoy.slice(0, 7)).parse(texto(busqueda.mes));
  const metas = await leerMetasDelMes(programId, mes, hoy);
  const anterior = moverMes(mes, -1);
  const siguiente = moverMes(mes, 1);
  const hrefMes = (otro: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(busqueda)) if (typeof v === "string") q.set(k, v);
    q.set("seccion", "hoy");
    q.set("mes", otro);
    return `?${q.toString()}#metas`;
  };
  const periodoDe = (rango: { desde: string; hasta: string }): PeriodoResuelto => ({ preset: "custom", a: rango, b: null });
  const hrefVentasMes = urlDeLista(slug, "cierres", periodoDe(metas.periodoMes));
  const hrefVentasSemana = metas.compensacionSemanal
    ? urlDeLista(slug, "cierres", periodoDe({ desde: metas.compensacionSemanal.desde, hasta: metas.compensacionSemanal.hasta }))
    : null;

  return (
    <section id="metas" className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Metas de {nombreDelMes(mes)}</h2>
        <nav aria-label="Cambiar mes" className="flex items-center gap-2">
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={hrefMes(anterior)}>← {nombreDelMes(anterior)}</Link>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={hrefMes(siguiente)}>{nombreDelMes(siguiente)} →</Link>
        </nav>
      </div>
      <MetasDelMes metas={metas} hrefVentasMes={hrefVentasMes} hrefVentasSemana={hrefVentasSemana} conListas={conListas} />
    </section>
  );
}
