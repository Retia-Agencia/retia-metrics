import { after } from "next/server";
import { Suspense, type ReactNode } from "react";
import { desc } from "drizzle-orm";
import { alertasDelPrograma } from "@/lib/queries/alertas";
import { VamosALlegar } from "@/components/metas/vamos-a-llegar";
import { canalesConEnlaces, hrefDePiezasDesconocidas } from "@/components/dashboard/origen";
import { Hoy } from "@/components/dashboard/hoy";
import { armarReporteDiario, rangoDeLaSemanaDelReporte, resolverDiaDelReporte, type ReporteDiario } from "@/lib/queries/reporte-diario";
import { SelectorDeDia } from "@/components/dashboard/selector-de-dia";
import { ConfiguracionHoy } from "@/components/dashboard/configuracion-hoy";
import { queryDePautaDesdeOrigen, rutaDePrograma, type SeccionDelHub } from "@/lib/nav";
import { detalleDeCifra, detallesDeOperacion, detallesDelDashboard, proyectarDashboardSegunRol, urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { esAdministrador, veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { parsearPeriodoUrl, type PeriodoResuelto } from "@/lib/periodo";
import { fecha, hoyEnBogota } from "@/lib/format";
import { armarVistaDelDashboard, resolverContextoDeVista, type ContextoDeVista, type EntradaDeVista, type VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { EsqueletoDelHub, EsqueletoDelNorte } from "@/components/hub/esqueleto-del-hub";
import { cohorteDeLaUrl, TODAS_LAS_COHORTES } from "@/lib/queries/cohorte-del-hub";
import { fraseSinActividad, lineaDeLaCohorte } from "@/lib/hub/linea-de-cohorte";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { origenDelPrograma } from "@/lib/queries/origen";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { embudoPorPregunta } from "@/lib/queries/embudo-por-pregunta";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion, type Pestana } from "@/components/layout/pestanas";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { DashboardPrograma } from "@/components/dashboard-programa";
import { detalleDePuntoAccion } from "./acciones-graficas";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import { FiltrosDelHub } from "@/components/hub/filtros-del-hub";
import { PautaProyeccion } from "@/components/pauta-proyeccion";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { calcularProyeccionDeRoas, proyeccionesConfirmadas } from "@/lib/queries/proyeccion-roas";
import { cargarRoasDePauta, type NivelPauta, type PasoPauta } from "@/lib/queries/roas-de-pauta";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { SemaforoDelPrograma } from "@/components/semaforo/semaforo-del-programa";
import { pautaSincronizaciones } from "@/lib/db/schema";
import { leerConfiguracionDeHoy } from "@/lib/queries/configuracion-de-hoy";
import { ventanaRitmoDeUrl } from "@/lib/queries/proyeccion";
import { sumarDias } from "@/lib/dias-habiles";
import { tokensMeta } from "@/lib/integraciones";
import { InfoDePagina } from "@/components/hub/info-de-pagina";
import { seccionesDeInfoDeHoy } from "@/components/dashboard/hoy/info-de-hoy";
import { seccionesDeInfoDeComercial } from "@/components/dashboard/info-de-comercial";
import { seccionesDeInfoDePauta } from "@/components/dashboard/info-de-pauta";
import { CumplimientoDeCohorte, unidadDeCumplimiento } from "@/components/pauta/cumplimiento";
import { capacidadParaMetrica, type Metrica } from "@/lib/queries/metricas-con-filas";
import { LISTAS_DE_LA_TABLA_SEMANAL, TablaSemanalDePauta } from "@/components/pauta/tabla-semanal";
import { QueTraeVentas } from "@/components/pauta/que-trae-ventas";
import { SinOrigen } from "@/components/pauta/sin-origen";
import { DondeSeVaLaGente } from "@/components/pauta/embudo-del-formulario";
import { VER_POR_ORIGEN, verPorOrigen, type VerPorOrigen } from "@/lib/pauta/cifras-de-origen";
import { VISTAS_DE_PAUTA, vistaDePauta } from "@/lib/pauta/vista-de-pauta";
import { cargarEmbudoComercial, type OrigenEmbudoComercial } from "@/lib/queries/embudo-comercial";
import { dineroDelRango } from "@/lib/queries/dashboard";
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
 * El filtro de closer de la URL es un `users.id` (ticket 167, Decision 5): un valor
 * que no es uuid se ignora (no filtra), igual que el filtro de area.
 */
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

  const busqueda = await searchParams;
  // `?seccion=origen` ya no existe (412): Origen es la vista Canal de Pauta.
  const haciaPauta = queryDePautaDesdeOrigen(busqueda);
  if (haciaPauta) redirect(`${rutaDePrograma(programa.slug, "hub")}${haciaPauta}`);
  const hoy = hoyEnBogota();

  // El Hub (ADR 0086, ticket 250): una pantalla fija con cuatro pestañas en `?seccion=`, en
  // este orden. Hoy junta lo que eran Pulso y Metas (el 252 lo rearma como reporte diario);
  // Comercial es la Operación de antes; Pauta junta origen, cohorte, embudo y ROAS (355, 412).
  const base = rutaDePrograma(programa.slug, "hub");
  const pestanas: Pestana[] = [
    {
      id: "hoy",
      etiqueta: "Hoy",
      descripcion: "¿Vamos a llegar? Objetivo del mes, ventas, caja y lo que pide atención.",
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
      descripcion: "Lo vendido, lo recaudado y lo que falta por cobrar.",
      href: urlConSeccion(base, busqueda, "dinero"),
    },
    {
      id: "pauta",
      etiqueta: "Pauta",
      descripcion: "De dónde vienen los registros, qué rindió la plata y cómo va la cohorte.",
      href: urlConSeccion(base, busqueda, "pauta"),
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
  // La ventana del ritmo de la Proyección sale de `?ritmo=`, validada: un valor raro vuelve a 10.
  const ventanaRitmo = ventanaRitmoDeUrl(busqueda.ritmo);
  // El día del reporte sale de `?fecha=` (373); una fecha futura o mal escrita se rechaza y se avisa.
  const diaPedido = resolverDiaDelReporte(texto(busqueda.fecha), hoy);
  const fechaRechazada = esHoy && diaPedido === null;
  const diaDelReporte = diaPedido ?? hoy;
  const hoyDeLaPestana = esHoy ? diaDelReporte : hoy;

  // Streaming: la cabecera (pestañas, periodo, cohorte) sale con lo BARATO (`resolverContextoDeVista`) y
  // cada cuerpo llega después dentro de su <Suspense>. El reporte de Hoy arranca ya con la MISMA promesa de
  // contexto (no se resuelve dos veces) y se espera en el cuerpo y en el panel de información; los `catch` vacíos
  // solo evitan el aviso de "rechazo sin manejar" si algo falla antes: quien espera la promesa sigue viendo el error.
  // Hoy usa la misma entrada que `armarVistaDeHoy`: el día del reporte como "hoy", periodo "hoy", programa entero.
  const entradaDeVista: EntradaDeVista = esHoy
    ? { programId: programa.id, hoy: diaDelReporte, periodo: { preset: "hoy" }, preset: "hoy", claveCloser: null }
    : {
        programId: programa.id,
        hoy,
        periodo: parsearPeriodoUrl(busqueda, { porDefecto: "desde_el_inicio" }),
        // El filtro de cohorte es del Hub y va a la consulta (377); Hoy no lo usa (viene de `armarVistaDeHoy`).
        filtroDeCohorte: { parametro: cohorteDeLaUrl(busqueda.cohorte) },
        preset: texto(busqueda.rango) ?? "hoy",
        desde: texto(busqueda.desde),
        hasta: texto(busqueda.hasta),
        claveCloser: veEquipo ? esquemaFiltroCloser.parse(texto(busqueda.closer)) ?? null : null,
      };
  // Una sola resolución del contexto: la cabecera la espera y el reporte de Hoy la reutiliza.
  const contextoPendiente = resolverContextoDeVista(entradaDeVista);
  contextoPendiente.catch(() => undefined);
  const reporteDeHoy = esHoy ? armarReporteDiario({ programId: programa.id, dia: diaDelReporte, ventanaRitmo, contexto: contextoPendiente }) : null;
  reporteDeHoy?.catch(() => undefined);
  const contexto = await contextoPendiente;
  const closersDelFiltro = !esHoy && veEquipo ? await contexto.closers() : [];

  const { elegida, opciones, ventas } = contexto.filtroDeCohorte;
  const conFiltroDeCohorte = seccion === "comercial" || seccion === "dinero" || seccion === "pauta";
  const lineaDeCohorte = conFiltroDeCohorte
    ? lineaDeLaCohorte({
        cohorte: elegida ? { codigo: elegida.codigo, metaCupos: elegida.metaCupos, inicioVentas: elegida.inicioVentas, cierreVentas: elegida.cierreVentas } : null,
        ventas,
      })
    : undefined;

  const { desde, hasta } = contexto.seleccion.rango;
  // Un solo dia se escribe una sola vez: "15 sep 2026", no "15 sep 2026 a 15 sep 2026".
  const rangoLegible = desde === hasta ? fecha(desde) : `${fecha(desde)} a ${fecha(hasta)}`;
  const origen = origenDeLaPagina(base, busqueda);
  const configurar = esAdministrador(rol)
    ? { hrefBase: `/p/${encodeURIComponent(programa.slug)}/programa?seccion=ventas`, origen }
    : null;
  const tituloDelInfo = seccion === "comercial"
    ? "Comercial: qué hay y cómo se calcula"
    : seccion === "pauta"
      ? "Pauta: qué hay y cómo se calcula"
      : "Hoy: qué hay y cómo se calcula";
  const datosDelPrograma = { id: programa.id, slug: programa.slug, nombre: programa.nombre };
  const norte = <VamosALlegar programa={datosDelPrograma} hoy={hoy} origen={origen} conListas={veEquipo} configurar={configurar} />;

  return (
    <PageShell
      titulo={programa.nombre}
      // La descripcion sale de la cohorte que esta en la base, no de un texto fijo:
      // un programa nuevo creado desde Ajustes describe su propia cohorte sin tocar
      // codigo (ADR 0012).
      descripcion={
        conFiltroDeCohorte
          ? `${elegida ? `Cohorte ${elegida.codigo}` : "Todas las cohortes"} · ${rangoLegible}`
          : contexto.cohorte
            ? `Cohorte ${contexto.cohorte.codigo} · ${rangoLegible}`
            : `Sin cohorte activa · ${rangoLegible}`
      }
      fija
    >
      <PantallaFija>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del Hub" />
          </div>
          {reporteDeHoy ? (
            <Suspense fallback={null}>
              <InfoDeHoy titulo={tituloDelInfo} programa={datosDelPrograma} reporte={reporteDeHoy} />
            </Suspense>
          ) : (
            <InfoDePagina titulo={tituloDelInfo} secciones={seccion === "comercial" ? seccionesDeInfoDeComercial() : seccion === "pauta" ? seccionesDeInfoDePauta() : []} />
          )}
        </div>
        {esHoy ? null : (
          <div className="flex min-w-0 max-w-full flex-wrap items-start justify-between gap-2">
            {seccion === "pauta" ? (
              <div className="order-first w-full sm:order-last sm:w-auto">
                <Pestanas
                  grupos={[{ pestanas: VISTAS_DE_PAUTA.map((v) => ({ ...v, href: urlConSeccion(base, busqueda, v.id === "resultados" ? null : v.id, { parametro: "vista" }) })) }]}
                  activa={vistaDePauta(busqueda.vista)}
                  etiqueta="Vista de Pauta"
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
            <FiltrosDelHub
              periodo={contexto.periodo}
              anteriorDisponible={contexto.anteriorDisponible}
              claveCloser={contexto.claveCloser}
              closers={closersDelFiltro}
              filtraCloser={veEquipo}
              cohorte={conFiltroDeCohorte ? { valor: elegida?.id ?? TODAS_LAS_COHORTES, opciones } : undefined}
              lineaDeCohorte={lineaDeCohorte}
            />
            </div>
          </div>
        )}

        <div className={clasesDeZonaConScroll()}>
          <Suspense key={`${slug}?${JSON.stringify(busqueda)}`} fallback={<EsqueletoDelHub />}>
            <CuerpoDelHub
              rol={rol}
              programa={datosDelPrograma}
              busqueda={busqueda}
              seccion={seccion}
              hoy={hoy}
              diaDelReporte={diaDelReporte}
              hoyDeLaPestana={hoyDeLaPestana}
              fechaRechazada={fechaRechazada}
              ventanaRitmo={ventanaRitmo}
              entradaDeVista={entradaDeVista}
              contexto={contexto}
              reporteDeHoy={reporteDeHoy}
              origen={origen}
              base={base}
              configurar={configurar}
              norte={<Suspense fallback={<EsqueletoDelNorte />}>{norte}</Suspense>}
            />
          </Suspense>
          {/* El norte (371): al pie de TODAS las pestañas y sin leer los filtros: solo programa y hoy. */}
          {/* En Hoy va dentro del reporte (secciones 4 y 5): no se repite abajo. */}
          {esHoy ? null : (
            <div className="mt-6">
              <Suspense fallback={<EsqueletoDelNorte />}>{norte}</Suspense>
            </div>
          )}
        </div>
      </PantallaFija>
    </PageShell>
  );
}

/** El panel de información de Hoy: sus secciones salen del reporte, así que espera a que llegue. */
async function InfoDeHoy({ titulo, programa, reporte }: {
  titulo: string;
  programa: { id: string; slug: string; nombre: string };
  reporte: Promise<ReporteDiario>;
}) {
  return <InfoDePagina titulo={titulo} secciones={seccionesDeInfoDeHoy([{ programa, reporte: await reporte }])} />;
}

/**
 * El cuerpo de una pestaña: lo pesado. Llega por streaming detrás de `<Suspense>` mientras la cabecera
 * ya está pintada. Pauta y Origen no necesitan `armarVistaDelDashboard` (sus consultas son propias y solo
 * leen el periodo del contexto), así que no esperan las ~40 consultas de cifras.
 */
async function CuerpoDelHub({
  rol, programa, busqueda, seccion, hoy, diaDelReporte, hoyDeLaPestana, fechaRechazada, ventanaRitmo,
  entradaDeVista, contexto, reporteDeHoy, origen, base, configurar, norte,
}: {
  rol: Awaited<ReturnType<typeof rolDeVista>>;
  programa: { id: string; slug: string; nombre: string };
  busqueda: Record<string, string | string[] | undefined>;
  seccion: string;
  hoy: string;
  diaDelReporte: string;
  hoyDeLaPestana: string;
  fechaRechazada: boolean;
  ventanaRitmo: ReturnType<typeof ventanaRitmoDeUrl>;
  entradaDeVista: EntradaDeVista;
  contexto: ContextoDeVista;
  reporteDeHoy: Promise<ReporteDiario> | null;
  origen: string;
  base: string;
  configurar: { hrefBase: string; origen: string } | null;
  norte: ReactNode;
}) {
  const slug = programa.slug;
  const esHoy = seccion === "hoy";
  const veEquipo = veEquipoComercial(rol);
  const proyectar = <T,>(valor: T): T => proyectarDashboardSegunRol(valor, rol);

  if (seccion === "pauta") {
    return (
      <SeccionPauta
        programId={programa.id}
        programaNombre={programa.nombre}
        slug={slug}
        rango={contexto.seleccion.rango}
        periodo={contexto.periodo}
        origen={origen}
        hoy={hoy}
        busqueda={busqueda}
        cohorteId={contexto.filtroDeCohorte.elegida?.id ?? null}
        cohorteCodigo={contexto.filtroDeCohorte.elegida?.codigo ?? null}
        puedeAbrirLista={veEquipo}
        puedeVerVentas={capacidadParaMetrica({ metrica: "cierres", tieneOrigen: false })(rol)}
        listasQueAbre={LISTAS_DE_LA_TABLA_SEMANAL.filter((metrica) => capacidadParaMetrica({ metrica, tieneOrigen: true })(rol))}
      />
    );
  }

  // Las gráficas de Dinero solo necesitan el periodo y la cohorte del contexto: arrancan YA, a la par de las
  // cifras, y llegan por su cuenta. Si la pestaña resulta vacía nadie las espera: el `catch` evita el aviso.
  const seriesDeDinero = seccion === "dinero"
    ? leerSeriesDeDinero({
        programId: programa.id,
        // El eje es el periodo elegido y A y B cada uno con su cohorte (370): sin meses fijos.
        a: { rango: contexto.periodo.a, cohorteId: contexto.filtroDeCohorte.cohorteId },
        b: contexto.periodo.b ? { rango: contexto.periodo.b, cohorteId: contexto.filtroDeCohorte.cohorteIdDeB } : null,
        claveCloser: contexto.claveCloser,
        hoy,
      })
    : undefined;
  seriesDeDinero?.catch(() => undefined);

  const vistaDeHoy = reporteDeHoy ? await reporteDeHoy : null;
  const vista = vistaDeHoy?.vista ?? await armarVistaDelDashboard(entradaDeVista, undefined, contexto);

  // La cohorte que filtra las cifras de esta pestaña; Hoy es del día entero y no la usa (373).
  const cohorteId = esHoy ? null : vista.filtroDeCohorte.cohorteId;
  const cohorteIdDeB = esHoy ? null : vista.filtroDeCohorte.cohorteIdDeB;
  const conFiltroDeCohorte = seccion === "comercial" || seccion === "dinero" || seccion === "pauta";
  const { elegida } = vista.filtroDeCohorte;
  // Cohorte y periodo que no se tocan se dicen; no se pinta una pantalla de ceros (N5).
  const sinActividad = conFiltroDeCohorte && elegida !== null
    && vista.embudo.agendas === 0 && vista.embudo.cierres === 0 && vista.caja.length === 0
    && (vista.leads.leads ?? 0) === 0 && vista.cortesias === 0;

  const configuracionDeHoy = esHoy && configurar ? leerConfiguracionDeHoy(programa.id) : null;

  // Las consultas de la pestaña son independientes entre sí: arrancan juntas (un viaje a la base, no seis).
  const entradaDetalles = { programId: programa.id, slug, hoy: hoyDeLaPestana, periodo: vista.periodo, claveCloser: vista.claveCloser, cohorteId, origen };
  const comparativoClaves = vista.comparativo.map((fila) => fila.clave);
  const periodoDelDia = { preset: "custom" as const, a: { desde: diaDelReporte, hasta: diaDelReporte }, b: null };
  const semanaDelReporte = rangoDeLaSemanaDelReporte(diaDelReporte);
  const periodoDeLaSemana = { preset: "custom" as const, a: semanaDelReporte, b: null };
  const listaDelDia = (metrica: "leads" | "citas_debidas" | "citas_sin_marcar") =>
    detalleDeCifra(metrica, { programId: programa.id, slug, hoy: diaDelReporte, periodo: periodoDelDia, claveCloser: null, origen });

  const [
    detallesCrudos,
    detalleMananaCrudo,
    detalleRegistros,
    detalleCitasDebidas,
    detalleCitasSinMarcar,
    detallesOperacionCrudos,
    vistaComercial,
    alertas,
    configuracionCruda,
  ] = await Promise.all([
    // Solo se calcula lo de la pestaña activa (ticket 197 §5).
    detallesDelDashboard(entradaDetalles),
    esHoy
      ? detalleDeCifra("agendas", {
          programId: programa.id,
          slug,
          hoy,
          periodo: { preset: "custom", a: { desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, 1) }, b: null },
          claveCloser: null,
          origen,
        })
      : undefined,
    esHoy ? listaDelDia("leads") : undefined,
    esHoy ? listaDelDia("citas_debidas") : undefined,
    esHoy ? listaDelDia("citas_sin_marcar") : undefined,
    (esHoy && veEquipo) || (seccion === "comercial" && !sinActividad)
      ? detallesDeOperacion(
          { programId: programa.id, slug, hoy: hoyDeLaPestana, periodo: vista.periodo, cohorteId, origen },
          comparativoClaves,
        )
      : undefined,
    seccion === "comercial" && !sinActividad
      ? cargarVistaComercial({ programa, busqueda, vista, cohorteId, cohorteIdDeB, origen, hoy, veEquipo, proyectar })
      : null,
    esHoy ? alertasDelPrograma(programa.id, hoy) : undefined,
    configuracionDeHoy,
  ]);

  const detalles: DetallesDelDashboard | undefined = proyectar(detallesCrudos);
  const detalleManana = esHoy ? proyectar(detalleMananaCrudo) : undefined;
  const detallesOperacion = detallesOperacionCrudos ? proyectar(detallesOperacionCrudos) : undefined;

  const datosConfiguracionHoy = configuracionCruda
    ? {
        ...configuracionCruda,
        slug: programa.slug,
        ritmo: ventanaRitmo,
        // Los números vivos para los ejemplos del panel: salen de la misma proyección que pinta Hoy.
        vivo: {
          faltan: vistaDeHoy!.proyeccion.faltan,
          diasHabilesRestantes: vistaDeHoy!.proyeccion.diasHabilesRestantes,
          ventasPorDia: vistaDeHoy!.proyeccion.ventasRequeridasDia.valor,
          leadsPorDia: vistaDeHoy!.proyeccion.leadsRequeridosDia.valor,
          razonCierre: vistaDeHoy!.proyeccion.supuestos.conversion.razonCierre,
          razonShow: vistaDeHoy!.proyeccion.supuestos.conversion.razonShow,
          objetivoAgendaAVenta: vistaDeHoy!.proyeccion.supuestos.conversion.objetivoAgendaAVenta,
          citasPorLead: vistaDeHoy!.proyeccion.supuestos.agendasPorRegistro,
          origenDeLaTasa: vistaDeHoy!.proyeccion.supuestos.conversion.origen === "cohorte_anterior" ? "cohorte anterior" : vistaDeHoy!.proyeccion.supuestos.conversion.origen === "cohorte_en_curso" ? "cohorte en curso" : "sin medición suficiente",
          personasConCita: vistaDeHoy!.proyeccion.supuestos.conversion.muestra?.personas ?? null,
          asistentes: vistaDeHoy!.proyeccion.supuestos.conversion.muestra?.shows ?? null,
        },
      }
    : null;

  // Las listas de las cifras de Hoy que no están en el tablero (378): los leads del día y las citas que ya
  // debían ocurrir (el denominador de la asistencia), y los enlaces de lo que llevamos en la semana.
  const listasDeHoy = esHoy
      ? {
        leadsDelDia: vistaDeHoy!.vista.leads?.leads ?? 0,
        detalleRegistros: proyectar(detalleRegistros!),
        detalleCitasDebidas: proyectar(detalleCitasDebidas!),
        detalleCitasSinMarcar: proyectar(detalleCitasSinMarcar!),
        enlacesDeLaSemana: veEquipo
          ? {
              cupos: urlDeLista({ slug, metrica: "cierres", periodo: periodoDeLaSemana, origen }),
              leads: urlDeLista({ slug, metrica: "registros", periodo: periodoDeLaSemana, origen }),
              asistencia: urlDeLista({ slug, metrica: "citas_debidas", periodo: periodoDeLaSemana, origen }),
              sinMarcar: urlDeLista({ slug, metrica: "citas_sin_marcar", periodo: periodoDeLaSemana, origen }),
            }
          : undefined,
      }
    : undefined;

  if (sinActividad) {
    return (
      <p role="status" className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        {fraseSinActividad(elegida?.codigo ?? null, vista.periodo)}
      </p>
    );
  }
  if (seccion === "comercial") {
    return (
      <div className="space-y-4">
        <DashboardPrograma
          seccion="operacion"
          vista={vista}
          detalles={detalles}
          detallesOperacion={detallesOperacion}
          slug={slug}
          origen={origen}
          veEquipo={veEquipo}
          hoy={hoy}
          dealsContraAgendasVista={vistaComercial!.dealsContraAgendas}
          embudoComercial={vistaComercial!.embudo}
          origenEmbudo={vistaComercial!.origenEmbudo}
          enlacesDeOrigen={vistaComercial!.enlacesDeOrigen}
          vistaEscalera={vistaComercial!.escalera}
          dineroPorCloser={vistaComercial!.dineroPorCloser}
          dealsContraAgendas={<DealsContraAgendas vista={vistaComercial!.dealsContraAgendas} origen={origen} hoy={hoy} />}
        />
      </div>
    );
  }
  if (seccion === "dinero") {
    return (
      <DashboardPrograma
        seccion="dinero"
        cargarResumenDePunto={detalleDePuntoAccion}
        vista={vista}
        detalles={detalles}
        slug={slug}
        hoy={hoy}
        // El embudo contra agendas es de Comercial; fuera de esa pestaña no se arma.
        dealsContraAgendas={null}
        origen={origen}
        veEquipo={veEquipo}
        seriesDinero={seriesDeDinero}
      />
    );
  }
  return (
    <>
      {fechaRechazada ? (
        <p role="alert" className="mb-3 rounded-md border border-tono-peligro/40 px-3 py-2 text-sm text-tono-peligro">
          Esa fecha no es válida (no puede ser futura): se muestra hoy.
        </p>
      ) : null}
      <Hoy
        programas={[{
          programa,
          reporte: vistaDeHoy!,
          detalles,
          detallesOperacion: veEquipo ? detallesOperacion : undefined,
          ...listasDeHoy,
        }]}
        dia={diaDelReporte}
        hoy={hoy}
        selector={<SelectorDeDia dia={diaDelReporte} hoy={hoy} base={{ path: base, params: {} }} />}
        vamosALlegar={norte}
        vista={vista}
        detalles={detalles}
        alertas={alertas!}
        slug={slug}
        veEquipo={veEquipo}
        detalleManana={detalleManana}
        configuracion={datosConfiguracionHoy ? <ConfiguracionHoy datos={datosConfiguracionHoy} /> : undefined}
        definirObjetivo={datosConfiguracionHoy ? <ConfiguracionHoy datos={datosConfiguracionHoy} enlace /> : undefined}
      />
    </>
  );
}

/** Comercial (381): un solo embudo de deals, filtrable por el origen del formulario. Sus consultas corren juntas. */
async function cargarVistaComercial({ programa, busqueda, vista, cohorteId, cohorteIdDeB, origen, hoy, veEquipo, proyectar }: {
  programa: { id: string; slug: string };
  busqueda: Record<string, string | string[] | undefined>;
  vista: VistaDelDashboard;
  cohorteId: string | null;
  cohorteIdDeB: string | null;
  origen: string;
  hoy: string;
  veEquipo: boolean;
  proyectar: <T>(valor: T) => T;
}) {
  const slug = programa.slug;
  const origenPedido = texto(busqueda.origen);
  const origenEmbudo = origenPedido === "completo" || origenPedido === "parcial" ? origenPedido : "todos";
  const filtroDeOrigen: OrigenEmbudoComercial | undefined = origenEmbudo === "todos" ? undefined : origenEmbudo;
  const entrada = { programId: programa.id, slug, hoy, periodo: vista.periodo, claveCloser: vista.claveCloser, cohorteId, origen };
  const metricas = ["embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_shows", "embudo_comercial_compraron"] as const;
  const [dealsContraAgendas, pasos, detallesEmbudo, escalera, dineroPorCloser] = await Promise.all([
    vistaDealsContraAgendas({
      programId: programa.id,
      slug,
      hoy,
      periodo: vista.periodo,
      claveCloser: vista.claveCloser,
      cohorteId,
      cohorteIdDeB,
      origen,
    }),
    cargarEmbudoComercial(db, { programId: programa.id, rango: vista.periodo.a, claveCloser: vista.claveCloser, cohorteId }, filtroDeOrigen),
    Promise.all(metricas.map((metrica) => detalleDeCifra(metrica, { ...entrada, origenDeal: filtroDeOrigen }))),
    vistaDeEscalera({ programId: programa.id, slug, hoy, periodo: vista.periodo, claveCloser: vista.claveCloser, cohorteId, cohorteIdDeB, origen, conEquipo: veEquipo }),
    Promise.all((veEquipo ? vista.comparativo : []).map(async (fila) => [fila.clave, await dineroDelRango({ programId: programa.id, rango: vista.periodo.a, claveCloser: fila.clave, cohorteId })] as const)),
  ]);
  const enlacesDeOrigen = Object.fromEntries((["todos", "completo", "parcial"] as const).map((valor) => {
    const url = new URL(origen, "http://retia.local");
    if (valor === "todos") url.searchParams.delete("origen");
    else url.searchParams.set("origen", valor);
    return [valor, `${url.pathname}${url.search}`];
  })) as Record<"todos" | "completo" | "parcial", string>;
  return {
    dealsContraAgendas: proyectar(dealsContraAgendas),
    embudo: proyectar(pasos.map((paso, indice) => ({ ...paso, detalle: detallesEmbudo[indice], detallePerdidos: indice > 0 ? detallesEmbudo[indice - 1] : undefined }))),
    origenEmbudo: origenEmbudo as "todos" | "completo" | "parcial",
    enlacesDeOrigen,
    escalera: proyectar(escalera),
    dineroPorCloser: Object.fromEntries(dineroPorCloser),
  };
}

/**
 * La pestaña "Pauta" (355): de dónde vienen los registros, el embudo y el ROAS, en una sola tabla.
 * Sus consultas son exclusivas de esta pestaña, así que solo corren cuando está
 * activa (ticket 197 §5). Una sola tabla con "Ver por: Campaña de Meta | Canal" (ticket 355):
 * el selector vive en la URL (`ver_por`) y reemplaza solo ese parámetro.
 */
async function SeccionPauta({
  programId,
  programaNombre,
  slug,
  rango,
  periodo,
  origen,
  hoy,
  busqueda,
  cohorteId,
  cohorteCodigo,
  puedeAbrirLista,
  puedeVerVentas,
  listasQueAbre,
}: {
  programId: string;
  programaNombre: string;
  slug: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  origen: string;
  hoy: string;
  busqueda: Record<string, string | string[] | undefined>;
  cohorteId: string | null;
  cohorteCodigo: string | null;
  puedeAbrirLista: boolean;
  /** Abre la lista de ventas (la reja de la página de lista): la evidencia de las barras de ventas. */
  puedeVerVentas: boolean;
  /** Las listas de la tabla semanal que la sesión abre: la evidencia de sus celdas. */
  listasQueAbre: readonly Metrica[];
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
  // La vista de Pauta (420): Resultados o Origen y calidad, con los mismos filtros. Solo corren las consultas de
  // la vista que se ve (197 §5); la proyección del ROAS necesita la vista del ROAS, así que la carga Resultados.
  const vista = vistaDePauta(busqueda.vista);
  const enlaceRoas = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => urlDeLista({
    slug, metrica: "pauta_meta", periodo: { ...periodo, b: null }, origen, pauta: { nivel, id, paso },
  });

  if (vista === "resultados") {
    const [roas, objetivosDeLaCohorte] = await Promise.all([
      cargarRoasDePauta(db, programId, rango, hoy, ahora),
      cohorteId ? objetivosDeCohortes(db, [cohorteId]) : Promise.resolve([]),
    ]);
    const [proyeccion, historial] = await Promise.all([
      calcularProyeccionDeRoas(db, { programId, rango, hoy, ahora, vista: roas }),
      proyeccionesConfirmadas(db, programId),
    ]);
    return (
      <section className="space-y-4" data-vista-de-pauta="resultados">
        <CumplimientoDeCohorte programId={programId} programa={programaNombre} slug={slug} cohorteId={cohorteId} hoy={hoy} origen={origen} puedeVerVentas={puedeVerVentas}
          unidad={unidadDeCumplimiento(busqueda.cumpl)}
          hrefDeUnidad={{
            cupos: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, null, { parametro: "cumpl" }),
            plata: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, "plata", { parametro: "cumpl" }),
          }} />
        <SemaforoDelPrograma programId={programId} programa={programaNombre} comparar={periodo.b !== null} />
        <TablaSemanalDePauta programId={programId} programa={programaNombre} cohorte={cohorteCodigo ?? undefined} slug={slug} rango={rango} periodo={periodo} origen={origen} hoy={hoy} cohorteId={cohorteId} listasQueAbre={listasQueAbre} />
        <PautaProyeccion proyeccion={proyeccion} historial={historial} objetivos={objetivosDeLaCohorte} hoy={hoy}
          programa={programaNombre} cohorte={cohorteCodigo ?? undefined}
          hrefPendientes={proyeccion.citasPendientes > 0 ? enlaceRoas("total", undefined, "pendiente") : null} />
      </section>
    );
  }

  const [roas, vistaOrigen, formulario, porPregunta] = await Promise.all([
    cargarRoasDePauta(db, programId, rango, hoy, ahora),
    origenDelPrograma(db, { programId, rango, hoy }),
    embudoDelFormulario(db, { programId, rango }),
    embudoPorPregunta(db, programId),
  ]);
  // "Ver por" vive en la URL (`ver_por`) y reemplaza solo ese parámetro; Campaña es el valor por defecto.
  const verPor = verPorOrigen(busqueda.ver_por);
  const base = rutaDePrograma(slug, "hub");
  const hrefDeVerPor = Object.fromEntries(VER_POR_ORIGEN.map((v) => [v.id,
    urlConSeccion(base, busqueda, v.id === "campana" ? null : v.id, { parametro: "ver_por" })])) as Record<VerPorOrigen, string>;
  const periodoEnPalabras = rango.desde === rango.hasta ? `el ${fecha(rango.desde)}` : `del ${fecha(rango.desde)} al ${fecha(rango.hasta)}`;
  const contexto = { vista: roas, enlace: puedeAbrirLista ? enlaceRoas : undefined, programa: programaNombre, periodo: periodoEnPalabras };

  return (
    <section className="space-y-4" data-vista-de-pauta="calidad">
      <QueTraeVentas contexto={contexto} verPor={verPor} hrefDeVerPor={hrefDeVerPor} enlace={enlaceRoas}
        hrefCsv={`/p/${encodeURIComponent(slug)}/hub/pauta-citas.csv?${new URLSearchParams({ periodo: "custom", a_desde: rango.desde, a_hasta: rango.hasta, sin_b: "1" })}`}
        canalesDeOrigen={verPor === "canal" ? { canales: canalesConEnlaces(vistaOrigen, slug, periodo, origen), totalEnvios: vistaOrigen.totalEnvios } : undefined} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SinOrigen contexto={contexto} programId={programId} rango={rango} vistaOrigen={vistaOrigen}
          hrefPiezasDesconocidas={hrefDePiezasDesconocidas(slug, periodo, origen)} />
        <DondeSeVaLaGente embudo={formulario} porPregunta={porPregunta} programa={programaNombre} periodo={periodoEnPalabras}
          hrefNoAgendaron={puedeAbrirLista ? urlDeLista({ slug, metrica: "no_agendaron", periodo, origen }) : undefined} />
      </div>
    </section>
  );
}
