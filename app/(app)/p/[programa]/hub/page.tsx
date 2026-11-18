import { resolverCorteDePauta, ROTULO_DIAGNOSTICO_SIN_CORTE, type CorteResuelto } from "@/lib/pauta/corte-de-pauta";
import { opcionesDeCorteDePauta } from "@/lib/pauta/opciones-de-corte";
import { cifrasClaveDeComercial, cifrasDeCloser } from "@/lib/hub/cifras-de-comercial";
import { cifrasDeEscalera, cifrasDelEmbudoComercial, cifrasDeCaminos, cifrasDeCitasPorSemana, cifrasDeAuditoria } from "@/lib/hub/cifras-de-recorridos";
import { explicacionesDeComercial } from "@/lib/hub/explicaciones-de-comercial";
import { explicacionesDeRecorridos } from "@/lib/metricas/explicacion";
import { cifrasDeHoy } from "@/lib/hub/cifras-de-hoy";
import { cifrasDeClosersDeHoy } from "@/lib/hub/cifras-de-pendientes-y-closers";
import { explicacionesDeHoy, explicacionesDeClosersDeHoy } from "@/lib/hub/explicaciones-de-hoy";
import { metaDeLeads } from "@/lib/queries/proyeccion";
import { cifrasDeDinero, cifrasPorCohorte } from "@/lib/hub/cifras-de-dinero";
import { explicacionesDeDinero } from "@/lib/hub/explicaciones-de-dinero";
import { comparacionesDe, nombreDePedido } from "@/lib/periodo";
import { after } from "next/server";
import { Suspense, type ReactNode } from "react";
import { VamosALlegar } from "@/components/metas/vamos-a-llegar";
import { canalesConEnlaces, hrefDePiezasDesconocidas } from "@/components/dashboard/origen";
import { Hoy } from "@/components/dashboard/hoy";
import { armarReporteDiario, rangoDeLaSemanaDelReporte, resolverDiaDelReporte, type ReporteDiario } from "@/lib/queries/reporte-diario";
import { SelectorDeDia } from "@/components/dashboard/selector-de-dia";
import { ConfiguracionHoy } from "@/components/dashboard/configuracion-hoy";
import { queryDePautaDesdeOrigen, rutaDePrograma, type SeccionDelHub } from "@/lib/nav";
import { claveDeAbiertos, urlDeLista } from "@/lib/queries/vista-metrica";
import { esAdministrador, veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { z } from "zod";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaDeTabOConfigurar } from "@/lib/auth/page-guards";
import { parsearPeriodoUrl, type PeriodoResuelto } from "@/lib/periodo";
import { num, fecha, hoyEnBogota } from "@/lib/format";
import { resolverContextoDeVista, type ContextoDeVista, type EntradaDeVista } from "@/lib/queries/vista-dashboard";
import { EsqueletoDelHub, EsqueletoDelNorte } from "@/components/hub/esqueleto-del-hub";
import { cohorteDeLaUrl, TODAS_LAS_COHORTES } from "@/lib/queries/cohorte-del-hub";
import { fraseSinActividad, lineaDeLaCohorte } from "@/lib/hub/linea-de-cohorte";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion, type Pestana } from "@/components/layout/pestanas";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { DashboardPrograma } from "@/components/dashboard-programa";
import { detalleDePuntoAccion } from "./acciones-graficas";
import { FiltrosDelHub } from "@/components/hub/filtros-del-hub";
import { PautaProyeccion } from "@/components/pauta-proyeccion";
import { type NivelPauta, type PasoPauta } from "@/lib/queries/roas-de-pauta";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { SemaforoDelPrograma } from "@/components/semaforo/semaforo-del-programa";
import { ventanaRitmoDeUrl } from "@/lib/queries/proyeccion";
import { tokensMeta } from "@/lib/integraciones";
import { InfoDePagina } from "@/components/hub/info-de-pagina";
import { seccionesDeInfoDeHoy } from "@/components/dashboard/hoy/info-de-hoy";
import { CumplimientoDeCohorte, unidadDeCumplimiento } from "@/components/pauta/cumplimiento";
import { capacidadParaMetrica, type Metrica } from "@/lib/queries/metricas-con-filas";
import { LISTAS_DE_LA_TABLA_SEMANAL, TablaSemanalDePauta } from "@/components/pauta/tabla-semanal";
import { pasoDeTablaDePauta } from "@/lib/queries/hechos/pauta-semanal";
import { QueTraeVentas } from "@/components/pauta/que-trae-ventas";
import { SinOrigen } from "@/components/pauta/sin-origen";
import { DondeSeVaLaGente } from "@/components/pauta/embudo-del-formulario";
import { VER_POR_ORIGEN, verPorOrigen, type VerPorOrigen } from "@/lib/pauta/cifras-de-origen";
import { resumenDeFiltrosDePauta, VISTAS_DE_PAUTA, vistaDePauta } from "@/lib/pauta/vista-de-pauta";
import {
  debeSincronizarDesdeElHub,
  sincronizarDiaEnCurso,
} from "@/lib/pauta/dia-en-curso";
import {
  cargarDatosDelHubDelPrograma,
  type EntradaDeDatosDelHubDelPrograma,
  type SeccionDelHubDelPrograma,
} from "@/lib/hub-programa/cargar-datos";

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
  const programa = await programaDeTabOConfigurar(session.user.id, rol, slug);
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
  const seccion = pestanaActiva(texto(busqueda.seccion), pestanas, "hoy") as SeccionDelHub;
  const opcionesDeCorte = seccion === "pauta" ? await opcionesDeCorteDePauta(db, programa.id) : [];
  const corte = resolverCorteDePauta(opcionesDeCorte, busqueda.corte, busqueda.corte_id);

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
  const tituloDelInfo = "Hoy: qué hay y cómo se calcula";
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
          ) : null}
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
              corte={seccion === "pauta" ? { opciones: opcionesDeCorte, elegido: corte } : undefined}
            />
            {seccion === "pauta" ? (
              <p className="mt-1 text-xs text-muted-foreground" data-testid="resumen-de-filtros">
                {resumenDeFiltrosDePauta({
                  programa: programa.nombre,
                  cohorte: elegida?.codigo ?? null,
                  rango: contexto.seleccion.rango,
                  comparacion: contexto.periodo.b,
                  closer: closersDelFiltro.find((c) => c.id === contexto.claveCloser)?.label ?? null,
                  escribirFecha: fecha,
                  corte,
                })}
              </p>
            ) : null}
            </div>
          </div>
        )}

        <div className={clasesDeZonaConScroll()}>
          <Suspense key={`${slug}?${JSON.stringify(busqueda)}`} fallback={<EsqueletoDelHub />}>
            <CuerpoDelHub
              rol={rol}
              programa={datosDelPrograma}
              busqueda={busqueda}
              corte={corte}
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
  return <InfoDePagina titulo={titulo} secciones={seccionesDeInfoDeHoy([{ programa, reporte: await reporte }], true)} />;
}

/**
 * El cuerpo de una pestaña: lo pesado. Llega por streaming detrás de `<Suspense>` mientras la cabecera
 * ya está pintada. Pauta y Origen no necesitan `armarVistaDelDashboard` (sus consultas son propias y solo
 * leen el periodo del contexto), así que no esperan las ~40 consultas de cifras.
 */
async function CuerpoDelHub({
  rol, programa, busqueda, seccion, hoy, diaDelReporte, hoyDeLaPestana, fechaRechazada, ventanaRitmo,
  entradaDeVista, contexto, reporteDeHoy, origen, base, configurar, norte, corte,
}: {
  rol: Awaited<ReturnType<typeof rolDeVista>>;
  programa: { id: string; slug: string; nombre: string };
  busqueda: Record<string, string | string[] | undefined>;
  corte: CorteResuelto | null;
  seccion: SeccionDelHubDelPrograma;
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
  const veEquipo = veEquipoComercial(rol);
  const entradaDelCargador = {
    programa, rol, busqueda, seccion, hoy, diaDelReporte, hoyDeLaPestana, ventanaRitmo,
    entradaDeVista, contexto, reporteDeHoy, origen, configurar, corte,
  };
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
        corte={corte}
        busqueda={busqueda}
        cohorteId={contexto.filtroDeCohorte.elegida?.id ?? null}
        cohorteCodigo={contexto.filtroDeCohorte.elegida?.codigo ?? null}
        puedeAbrirLista={veEquipo}
        puedeVerVentas={capacidadParaMetrica({ metrica: "cierres", tieneOrigen: false })(rol)}
        listasQueAbre={LISTAS_DE_LA_TABLA_SEMANAL.filter((metrica) => capacidadParaMetrica({ metrica, tieneOrigen: true })(rol))}
        entradaDelCargador={entradaDelCargador}
      />
    );
  }

  const datos = await cargarDatosDelHubDelPrograma(db, entradaDelCargador);
  if (datos.seccion === "pauta") throw new Error("La sección de Pauta se arma en SeccionPauta");


  const { vista, cohorteId, sinActividad, detalles } = datos;
  const { elegida } = vista.filtroDeCohorte;
  const semanaDelReporte = rangoDeLaSemanaDelReporte(diaDelReporte);
  const periodoDeLaSemana = { preset: "custom" as const, a: semanaDelReporte, b: null };

  const datosConfiguracionHoy = datos.seccion === "hoy" && datos.configuracionCruda
    ? {
        ...datos.configuracionCruda,
        slug: programa.slug,
        ritmo: ventanaRitmo,
        // Los números vivos para los ejemplos del panel: salen de la misma proyección que pinta Hoy.
        vivo: {
          faltan: datos.vistaDeHoy.proyeccion.faltan,
          diasHabilesRestantes: datos.vistaDeHoy.proyeccion.diasHabilesRestantes,
          ventasPorDia: datos.vistaDeHoy.proyeccion.ventasRequeridasDia.valor,
          leadsPorDia: datos.vistaDeHoy.proyeccion.leadsRequeridosDia.valor,
          razonCierre: datos.vistaDeHoy.proyeccion.supuestos.conversion.razonCierre,
          razonShow: datos.vistaDeHoy.proyeccion.supuestos.conversion.razonShow,
          objetivoAgendaAVenta: datos.vistaDeHoy.proyeccion.supuestos.conversion.objetivoAgendaAVenta,
          citasPorLead: datos.vistaDeHoy.proyeccion.supuestos.agendasPorRegistro,
          origenDeLaTasa: datos.vistaDeHoy.proyeccion.supuestos.conversion.origen === "cohorte_anterior" ? "cohorte anterior" : datos.vistaDeHoy.proyeccion.supuestos.conversion.origen === "cohorte_en_curso" ? "cohorte en curso" : "sin medición suficiente",
          personasConCita: datos.vistaDeHoy.proyeccion.supuestos.conversion.muestra?.personas ?? null,
          asistentes: datos.vistaDeHoy.proyeccion.supuestos.conversion.muestra?.shows ?? null,
        },
      }
    : null;

  // Las listas de las cifras de Hoy que no están en el tablero (378): los leads del día y las citas que ya
  // debían ocurrir (el denominador de la asistencia), y los enlaces de lo que llevamos en la semana.
  const listasDeHoy = datos.seccion === "hoy"
      ? {
        leadsDelDia: datos.vistaDeHoy.vista.leads?.leads ?? 0,
        detalleRegistros: datos.detalleRegistros,
        detalleCitasDebidas: datos.detalleCitasDebidas,
        detalleCitasSinMarcar: datos.detalleCitasSinMarcar,
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
  if (datos.seccion === "comercial") {
    const comercial = datos.vistaComercial!;
    const detallesOperacion = datos.detallesOperacion;
    const contexto = {
      programa: programa.nombre, cohorte: vista.filtroDeCohorte.elegida?.codigo ?? null,
      rango: vista.periodo.a, hoy,
      closer: vista.closers.find((c) => c.id === vista.claveCloser)?.label ?? null,
    };
    const explicaciones = explicacionesDeComercial();
    const recorridos = { contexto, explicaciones: explicacionesDeRecorridos() };
    const primeraComparacion = comparacionesDe(vista.periodo)[0];
    const referencia = primeraComparacion ? nombreDePedido(primeraComparacion.pedido, vista.periodo.preset) : undefined;
    const clave = cifrasClaveDeComercial({ embudo: vista.embudo, anterior: vista.anterior?.embudo, referencia,
      detalles, evidencia: datos.evidencia, explicaciones, contexto });
    // La lista del grupo no expone quién suma arriba. No se inventa ese indicador en la página.
    for (const cifra of [clave.asistencia, clave.cierreDeVentas, clave.citaAVenta]) {
      if (cifra.explicacion.evidencia) cifra.explicacion.evidencia.nota = "Personas del grupo de abajo de la fórmula. La lista completa permite revisar cada deal.";
    }
    const escalera = cifrasDeEscalera({ ...recorridos, vista: comercial.escalera, referencia });
    const caminos = cifrasDeCaminos({ ...recorridos, embudo: vista.embudoEtapas });
    // Los recorridos conservan sus listas proyectadas, sin lectura de cinco filas.
    for (const camino of caminos) for (const [indice, paso] of camino.pasos.entries()) {
      const siguiente = camino.pasos[indice + 1]?.etapa;
      const d = detallesOperacion?.embudo;
      for (const [cifra, detalle] of [
        [paso.pasaron, siguiente ? d?.pasos[siguiente] : undefined],
        [paso.siguen, d?.siguen[paso.etapa]], [paso.perdidos, d?.perdidos[paso.etapa]],
        [paso.diasMedianos, d?.tiempo[paso.etapa === "ganado" ? "ganado_parcial" : paso.etapa]],
      ] as const) {
        if (detalle?.href && detalle.resumen.disponible) cifra.explicacion.evidencia = {
          href: detalle.href, boton: `Ver los ${num(detalle.resumen.subtotal.cantidad)} deals`, filas: [], nota: null,
        };
      }
    }
    const embudo = cifrasDelEmbudoComercial({ ...recorridos, pasos: comercial.embudo, origen: comercial.origenEmbudo });
    for (const [indice, paso] of embudo.entries()) {
      const detalle = comercial.embudo[indice].detallePerdidos;
      // La lista heredada es el paso anterior completo, no un filtro de los que se perdieron.
      if (paso.perdidos && detalle?.href && detalle.resumen.disponible) paso.perdidos.explicacion.evidencia = {
        href: detalle.href, boton: `Ver los ${num(detalle.resumen.subtotal.cantidad)} deals del paso anterior`, filas: [],
        nota: "La lista abre el paso anterior completo, incluidos quienes avanzaron.",
      };
    }
    const cifrasComercial = {
      clave, escalera, caminos, embudo,
      semanas: cifrasDeCitasPorSemana({ ...recorridos, semanas: detallesOperacion?.semanas ?? [], proximas: detallesOperacion?.proximas ?? [] }),
      auditoria: cifrasDeAuditoria({ ...recorridos, embudo: {
        ...vista.embudoEtapas,
        abiertos: (veEquipo ? vista.embudoEtapas.abiertos : []).map((f) => ({ ...f, detalle: detallesOperacion?.embudo.abiertos[claveDeAbiertos(f.etapa, f.ownerUserId)] })),
        sinDuenoPorAntiguedad: vista.embudoEtapas.sinDuenoPorAntiguedad.map((f) => ({ ...f, detalle: detallesOperacion?.embudo.sinDueno[f.bucket] })),
      }, ventasSinLlamada: comercial.escalera.principal.grupos.ventas_sin_llamada }),
      closers: veEquipo ? vista.comparativo.map((fila) => cifrasDeCloser({ fila, dinero: comercial.dineroPorCloser[fila.clave],
        detalles: detallesOperacion?.comparativo[fila.clave], explicaciones, contexto })) : undefined,
    };
    return (
      <div className="space-y-4">
        <DashboardPrograma
          seccion="operacion"
          cifrasComercial={cifrasComercial}
          vista={vista}
          detalles={detalles}
          detallesOperacion={detallesOperacion}
          slug={slug}
          origen={origen}
          veEquipo={veEquipo}
          hoy={hoy}
          dealsContraAgendasVista={comercial.dealsContraAgendas}
          embudoComercial={comercial.embudo}
          origenEmbudo={comercial.origenEmbudo}
          enlacesDeOrigen={comercial.enlacesDeOrigen}
          vistaEscalera={comercial.escalera}
          dineroPorCloser={comercial.dineroPorCloser}
          dealsContraAgendas={<DealsContraAgendas sinInfo vista={comercial.dealsContraAgendas} origen={origen} hoy={hoy} />}
        />
      </div>
    );
  }
  if (datos.seccion === "dinero") {
    const explicaciones = explicacionesDeDinero();
    const contextoDeCifras = {
      programa: programa.nombre,
      cohorte: vista.filtroDeCohorte.elegida?.codigo ?? null,
      rango: vista.periodo.a,
      hoy,
      closer: vista.closers.find((closer) => closer.id === vista.claveCloser)?.label ?? null,
    };
    const primeraComparacion = comparacionesDe(vista.periodo)[0];
    const cifras = cifrasDeDinero({
      dinero: vista.dinero, caja: vista.caja, anterior: vista.anterior,
      referencia: primeraComparacion ? nombreDePedido(primeraComparacion.pedido, vista.periodo.preset) : undefined,
      detalles, evidencia: datos.evidencia, explicaciones, contexto: contextoDeCifras,
    });
    const cohortes = cifrasPorCohorte({ filas: vista.ventasPorCohorte, detalles: datos.detallesPorCohorte, explicaciones, contexto: contextoDeCifras });
    return (
      <DashboardPrograma
        seccion="dinero"
        cifrasDinero={{ cifras, cohortes, fraccionRecaudada: vista.dinero.vendido > 0
          ? Math.min(1, vista.dinero.recaudado / vista.dinero.vendido) : null }}
        cargarResumenDePunto={detalleDePuntoAccion}
        vista={vista}
        detalles={detalles}
        slug={slug}
        hoy={hoy}
        // El embudo contra agendas es de Comercial; fuera de esa pestaña no se arma.
        dealsContraAgendas={null}
        origen={origen}
        veEquipo={veEquipo}
        seriesDinero={datos.seriesDeDinero}
      />
    );
  }
  const reporte = datos.vistaDeHoy;
  const detallesOperacion = datos.detallesOperacion;
  const explicaciones = explicacionesDeHoy();
  // Solo universos con paridad probada en cifras-de-hoy.test.ts. Una lectura por lista, cinco filas como máximo.
  const cifrasHoy = cifrasDeHoy({
    datos: {
      embudo: reporte.vista.embudo, sinResultado: reporte.vista.sinResultado, registros: reporte.registros,
      leadsDelDia: reporte.vista.leads?.leads ?? null,
      dia: reporte.horizontes.find((h) => h.clave === "dia")!, semana: reporte.horizontes.find((h) => h.clave === "semana")!,
      diasDeLaSemana: reporte.contexto.semana, objetivoDeLeads: metaDeLeads(reporte.proyeccion.cohorte),
      leadsQueHacenFalta: reporte.proyeccion.leadsRequeridosDia, caja: reporte.caja, dinero: reporte.dinero,
      leadsDeLaSemana: reporte.leadsDeLaSemana, showDeLaSemana: reporte.showDeLaSemana, citasDeManana: reporte.citasDeManana.length,
    },
    explicaciones, programa: programa.nombre, dia: diaDelReporte, hoy, lunes: semanaDelReporte.desde,
    detalles: detalles ? { ...detalles, sin_resultado: undefined } : undefined, evidencia: datos.evidenciaDeHoy,
    enlacesDeLaSemana: listasDeHoy?.enlacesDeLaSemana,
  });
  const cifrasClosers = veEquipo ? cifrasDeClosersDeHoy({
    filas: reporte.vista.comparativo, explicaciones: explicacionesDeClosersDeHoy(explicaciones),
    programa: programa.nombre, dia: diaDelReporte, hoy, detalles: detallesOperacion?.comparativo,
  }).map((fila, i) => ({ ...fila, entroACaja: reporte.vista.comparativo[i].caja.length ? fila.entroACaja : [] })) : undefined;
  return (
    <>
      {fechaRechazada ? (
        <p role="alert" className="mb-3 rounded-md border border-tono-peligro/40 px-3 py-2 text-sm text-tono-peligro">
          Esa fecha no es válida (no puede ser futura): se muestra hoy.
        </p>
      ) : null}
      <Hoy
        cifras={cifrasHoy}
        cifrasDeClosers={cifrasClosers}
        programas={[{
          programa,
          reporte,
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
        alertas={datos.alertas!}
        slug={slug}
        veEquipo={veEquipo}
        detalleManana={datos.detalleManana}
        configuracion={datosConfiguracionHoy ? <ConfiguracionHoy datos={datosConfiguracionHoy} /> : undefined}
        definirObjetivo={datosConfiguracionHoy ? <ConfiguracionHoy datos={datosConfiguracionHoy} enlace /> : undefined}
      />
    </>
  );
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
  entradaDelCargador,
  corte,
}: {
  programId: string;
  programaNombre: string;
  slug: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  origen: string;
  hoy: string;
  busqueda: Record<string, string | string[] | undefined>;
  corte: CorteResuelto | null;
  cohorteId: string | null;
  cohorteCodigo: string | null;
  puedeAbrirLista: boolean;
  /** Abre la lista de ventas (la reja de la página de lista): la evidencia de las barras de ventas. */
  puedeVerVentas: boolean;
  /** Las listas de la tabla semanal que la sesión abre: la evidencia de sus celdas. */
  listasQueAbre: readonly Metrica[];
  entradaDelCargador: EntradaDeDatosDelHubDelPrograma;
}) {
  const datos = await cargarDatosDelHubDelPrograma(db, entradaDelCargador);
  if (datos.seccion !== "pauta") throw new Error("SeccionPauta solo se arma con la sección de Pauta");
  if (debeSincronizarDesdeElHub(datos.ultimaSincronizacion?.inicio ?? null, datos.ahora)) {
    after(async () => {
      try {
        const resultado = await sincronizarDiaEnCurso(db, {
          tokens: await tokensMeta(db),
          ahora: datos.ahora,
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
  const enlaceSinCorte = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => urlDeLista({
    slug, metrica: "pauta_meta", periodo: { ...periodo, b: null }, origen, pauta: { nivel, id, paso },
  });
  const enlaceRoas = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => {
    const href = enlaceSinCorte(nivel, id, paso);
    return corte ? `${href}&${new URLSearchParams({ corte: corte.nivel, corte_id: corte.uuid })}` : href;
  };

  if (datos.vista === "resultados") {
    return (
      <section className="space-y-4" data-vista-de-pauta="resultados">
        <CumplimientoDeCohorte programId={programId} programa={programaNombre} slug={slug} cohorteId={cohorteId} hoy={hoy} origen={origen} puedeVerVentas={puedeVerVentas}
          unidad={unidadDeCumplimiento(busqueda.cumpl)}
          hrefDeUnidad={{
            cupos: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, null, { parametro: "cumpl" }),
            plata: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, "plata", { parametro: "cumpl" }),
          }} />
        <SemaforoDelPrograma programId={programId} programa={programaNombre} comparar={periodo.b !== null} corte={corte} />
        <TablaSemanalDePauta programId={programId} programa={programaNombre} cohorte={cohorteCodigo ?? undefined} slug={slug} rango={rango} periodo={periodo} origen={origen} hoy={hoy} cohorteId={cohorteId} listasQueAbre={listasQueAbre} corte={corte}
          paso={pasoDeTablaDePauta(busqueda.tabla)}
          hrefDePaso={{
            semana: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, null, { parametro: "tabla" }),
            dia: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, "dia", { parametro: "tabla" }),
          }}
          porCuenta={busqueda.por_cuenta === "1"}
          hrefDeCuenta={{
            total: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, null, { parametro: "por_cuenta" }),
            cuenta: urlConSeccion(rutaDePrograma(slug, "hub"), busqueda, "1", { parametro: "por_cuenta" }),
          }} />
        <PautaProyeccion proyeccion={datos.proyeccion} historial={corte ? [] : datos.historial} objetivos={datos.objetivosDeLaCohorte} hoy={hoy}
          programa={programaNombre} cohorte={cohorteCodigo ?? undefined} corte={corte}
          hrefPendientes={datos.proyeccion.citasPendientes > 0 ? enlaceRoas("total", undefined, "pendiente") : null} />
      </section>
    );
  }

  // "Ver por" vive en la URL (`ver_por`) y reemplaza solo ese parámetro; Campaña es el valor por defecto.
  const verPor = verPorOrigen(busqueda.ver_por);
  const base = rutaDePrograma(slug, "hub");
  const hrefDeVerPor = Object.fromEntries(VER_POR_ORIGEN.map((v) => [v.id,
    urlConSeccion(base, busqueda, v.id === "campana" ? null : v.id, { parametro: "ver_por" })])) as Record<VerPorOrigen, string>;
  const periodoEnPalabras = rango.desde === rango.hasta ? `el ${fecha(rango.desde)}` : `del ${fecha(rango.desde)} al ${fecha(rango.hasta)}`;
  const contexto = { vista: datos.roas, enlace: puedeAbrirLista ? enlaceRoas : undefined, programa: programaNombre, periodo: periodoEnPalabras, corte };

  return (
    <section className="space-y-4" data-vista-de-pauta="calidad">
      <QueTraeVentas contexto={contexto} verPor={verPor} hrefDeVerPor={hrefDeVerPor} enlace={enlaceRoas}
        hrefCsv={`/p/${encodeURIComponent(slug)}/hub/pauta-citas.csv?${new URLSearchParams({ periodo: "custom", a_desde: rango.desde, a_hasta: rango.hasta, sin_b: "1", ...(corte ? { corte: corte.nivel, corte_id: corte.uuid } : {}) })}`}
        canalesDeOrigen={verPor === "canal" ? { canales: canalesConEnlaces(datos.vistaOrigen, slug, periodo, origen), totalEnvios: datos.vistaOrigen.totalEnvios } : undefined} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SinOrigen aviso={corte ? ROTULO_DIAGNOSTICO_SIN_CORTE : undefined} contexto={{ ...contexto, vista: datos.roasDelDiagnostico, corte: null, enlace: puedeAbrirLista ? enlaceSinCorte : undefined }} programId={programId} rango={rango} vistaOrigen={datos.vistaOrigen}
          hrefPiezasDesconocidas={hrefDePiezasDesconocidas(slug, periodo, origen)} />
        <DondeSeVaLaGente embudo={datos.formulario} porPregunta={datos.porPregunta} programa={programaNombre} periodo={periodoEnPalabras}
          hrefNoAgendaron={puedeAbrirLista ? urlDeLista({ slug, metrica: "no_agendaron", periodo, origen }) : undefined} />
      </div>
    </section>
  );
}
