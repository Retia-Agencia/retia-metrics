import Link from "next/link";
import { after } from "next/server";
import { desc } from "drizzle-orm";
import { alertasDelPrograma } from "@/lib/queries/alertas";
import { VamosALlegar } from "@/components/metas/vamos-a-llegar";
import { leerMetasDelMes, moverMes, nombreDelMes } from "@/lib/queries/metas";
import { MetasDelMes } from "@/components/metas/metas-del-mes";
import { Origen } from "@/components/dashboard/origen";
import { Hoy } from "@/components/dashboard/hoy";
import { armarReporteDiario, rangoDeLaSemanaDelReporte, resolverDiaDelReporte } from "@/lib/queries/reporte-diario";
import { SelectorDeDia } from "@/components/dashboard/selector-de-dia";
import { ConfiguracionHoy } from "@/components/dashboard/configuracion-hoy";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rutaDePrograma, type SeccionDelHub } from "@/lib/nav";
import { detalleDeCifra, detallesDeOperacion, detallesDelDashboard, sinListas, urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { esAdministrador, veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import { z } from "zod";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { parsearPeriodoUrl, type PeriodoResuelto } from "@/lib/periodo";
import { contextoDeCifra } from "@/lib/contexto-de-cifra";
import { fecha, hoyEnBogota } from "@/lib/format";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { cohorteDeLaUrl, TODAS_LAS_COHORTES } from "@/lib/queries/cohorte-del-hub";
import { fraseSinActividad, lineaDeLaCohorte } from "@/lib/hub/linea-de-cohorte";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { pautaInterina, type FiltrosPauta } from "@/lib/queries/pauta-interina";
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
import { Escalera } from "@/components/dashboard/escalera";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import { FiltroDashboard } from "@/components/filtro-dashboard";
import { PautaInterina, type EnlaceDeLista } from "@/components/pauta-interina";
import { PautaRoas } from "@/components/pauta-roas";
import { cargarRoasDePauta, type NivelPauta, type PasoPauta } from "@/lib/queries/roas-de-pauta";
import { EmbudoFormulario } from "@/components/embudo-formulario";
import { EmbudoPorPregunta } from "@/components/embudo-por-pregunta";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { SemaforoDelPrograma } from "@/components/semaforo/semaforo-del-programa";
import { pautaSincronizaciones } from "@/lib/db/schema";
import { leerConfiguracionDeHoy } from "@/lib/queries/configuracion-de-hoy";
import { ventanaRitmoDeUrl } from "@/lib/queries/proyeccion";
import { sumarDias } from "@/lib/rangos";
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
  // La ventana del ritmo de la Proyección sale de `?ritmo=`, validada: un valor raro vuelve a 10.
  const ventanaRitmo = ventanaRitmoDeUrl(busqueda.ritmo);
  // El día del reporte sale de `?fecha=` (373); una fecha futura o mal escrita se rechaza y se avisa.
  const diaPedido = resolverDiaDelReporte(texto(busqueda.fecha), hoy);
  const fechaRechazada = esHoy && diaPedido === null;
  const diaDelReporte = diaPedido ?? hoy;
  const hoyDeLaPestana = esHoy ? diaDelReporte : hoy;
  const vistaDeHoy = esHoy ? await armarReporteDiario({ programId: programa.id, dia: diaDelReporte, ventanaRitmo }) : null;
  const vista = vistaDeHoy?.vista ?? await armarVistaDelDashboard({
        programId: programa.id,
        hoy,
        periodo: parsearPeriodoUrl(busqueda, { porDefecto: "desde_el_inicio" }),
        // El filtro de cohorte es del Hub y va a la consulta (377); Hoy no lo usa (viene de `armarVistaDeHoy`).
        filtroDeCohorte: { parametro: cohorteDeLaUrl(busqueda.cohorte) },
        preset: texto(busqueda.rango) ?? "hoy",
        desde: texto(busqueda.desde),
        hasta: texto(busqueda.hasta),
        claveCloser: veEquipo ? esquemaFiltroCloser.parse(texto(busqueda.closer)) ?? null : null,
      });

  // La cohorte que filtra las cifras de esta pestaña; Hoy es del día entero y no la usa (373).
  const cohorteId = esHoy ? null : vista.filtroDeCohorte.cohorteId;
  const cohorteIdDeB = esHoy ? null : vista.filtroDeCohorte.cohorteIdDeB;
  const { elegida, opciones, ventas } = vista.filtroDeCohorte;
  const conFiltroDeCohorte = seccion === "comercial" || seccion === "dinero";
  const lineaDeCohorte = conFiltroDeCohorte
    ? lineaDeLaCohorte({
        cohorte: elegida ? { codigo: elegida.codigo, metaCupos: elegida.metaCupos, inicioVentas: elegida.inicioVentas, cierreVentas: elegida.cierreVentas } : null,
        ventas,
      })
    : undefined;
  // Cohorte y periodo que no se tocan se dicen; no se pinta una pantalla de ceros (N5).
  const sinActividad = conFiltroDeCohorte && elegida !== null
    && vista.embudo.agendas === 0 && vista.embudo.cierres === 0 && vista.caja.length === 0
    && (vista.leads.leads ?? 0) === 0 && vista.cortesias === 0;

  // Cada cifra abre su lista y su "Volver" regresa a ESTA pestaña con ESTE filtro: el
  // origen (path + query, con `seccion`) viaja como parámetro `desde` en el href de cada lista
  // (ticket 174, 197), SOLO por `enlaceConVuelta` dentro de `detalleDeCifra`.
  const origen = origenDeLaPagina(base, busqueda);
  const configurar = esAdministrador(rol)
    ? { hrefBase: `/p/${encodeURIComponent(programa.slug)}/programa?seccion=ventas`, origen }
    : null;
  const configuracionDeHoy = esHoy && configurar ? await leerConfiguracionDeHoy(programa.id) : null;
  const datosConfiguracionHoy = configuracionDeHoy
    ? {
        ...configuracionDeHoy,
        slug: programa.slug,
        ritmo: ventanaRitmo,
        // Los números vivos para los ejemplos del panel: salen de la misma proyección que pinta Hoy.
        vivo: {
          faltan: vistaDeHoy!.proyeccion.faltan,
          diasHabilesRestantes: vistaDeHoy!.proyeccion.diasHabilesRestantes,
          ventasPorDia: vistaDeHoy!.proyeccion.ventasRequeridasDia.valor,
          leadsPorDia: vistaDeHoy!.proyeccion.leadsRequeridosDia.valor,
          pctCierre: vistaDeHoy!.proyeccion.supuestos.conversion.pctCierre,
          pctShow: vistaDeHoy!.proyeccion.supuestos.conversion.pctShow,
          objetivoAgendaAVenta: vistaDeHoy!.proyeccion.supuestos.conversion.objetivoAgendaAVenta,
          citasPorLead: vistaDeHoy!.proyeccion.supuestos.agendasPorRegistro,
          origenDeLaTasa: vistaDeHoy!.proyeccion.supuestos.conversion.origen === "cohorte_anterior" ? "cohorte anterior" : vistaDeHoy!.proyeccion.supuestos.conversion.origen === "cohorte_en_curso" ? "cohorte en curso" : "sin medición suficiente",
          personasConCita: vistaDeHoy!.proyeccion.supuestos.conversion.muestra?.personas ?? null,
          asistentes: vistaDeHoy!.proyeccion.supuestos.conversion.muestra?.shows ?? null,
        },
      }
    : null;

  // Solo se calcula lo de la pestaña activa (ticket 197 §5): a esta escala el ahorro no
  // importa, pero cada bloque es una consulta que no vale la pena correr fuera de su
  // pestaña. `armarVistaDelDashboard` sí calcula todo junto y se deja así.
  const necesitaDetalles = seccion === "hoy" || seccion === "comercial" || seccion === "dinero";
  const detalles: DetallesDelDashboard | undefined = necesitaDetalles
    ? proyectar(await detallesDelDashboard({
        programId: programa.id,
        slug,
        hoy: hoyDeLaPestana,
        periodo: vista.periodo,
        claveCloser: vista.claveCloser,
        cohorteId,
        origen,
      }))
    : undefined;
  const detalleManana = esHoy
    ? proyectar(await detalleDeCifra("agendas", {
        programId: programa.id,
        slug,
        hoy,
        periodo: { preset: "custom", a: { desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, 1) }, b: null },
        claveCloser: null,
        origen,
      }))
    : undefined;
  // Las listas de las cifras de Hoy que no están en el tablero (378): los leads del día y las citas que ya
  // debían ocurrir (el denominador de la asistencia), y los enlaces de lo que llevamos en la semana.
  const periodoDelDia = { preset: "custom" as const, a: { desde: diaDelReporte, hasta: diaDelReporte }, b: null };
  const semanaDelReporte = rangoDeLaSemanaDelReporte(diaDelReporte);
  const periodoDeLaSemana = { preset: "custom" as const, a: semanaDelReporte, b: null };
  const listasDeHoy = esHoy
    ? {
        detalleRegistros: proyectar(await detalleDeCifra("registros", { programId: programa.id, slug, hoy: diaDelReporte, periodo: periodoDelDia, claveCloser: null, origen })),
        detalleCitasDebidas: proyectar(await detalleDeCifra("citas_debidas", { programId: programa.id, slug, hoy: diaDelReporte, periodo: periodoDelDia, claveCloser: null, origen })),
        enlacesDeLaSemana: veEquipo
          ? {
              cupos: urlDeLista({ slug, metrica: "cierres", periodo: periodoDeLaSemana, origen }),
              leads: urlDeLista({ slug, metrica: "registros", periodo: periodoDeLaSemana, origen }),
              asistencia: urlDeLista({ slug, metrica: "citas_debidas", periodo: periodoDeLaSemana, origen }),
            }
          : undefined,
      }
    : undefined;

  // Comercial (372): los deals partidos por origen y los registros, una vez, para la tabla y el embudo.
  const vistaComercial = seccion === "comercial" && !sinActividad
    ? {
        dealsContraAgendas: proyectar(await vistaDealsContraAgendas({
          programId: programa.id,
          slug,
          hoy,
          periodo: vista.periodo,
          claveCloser: vista.claveCloser,
          cohorteId,
          cohorteIdDeB,
          origen,
        })),
        detalleRegistros: proyectar(await detalleDeCifra("registros", {
          programId: programa.id,
          slug,
          hoy,
          periodo: vista.periodo,
          claveCloser: vista.claveCloser,
          cohorteId,
          origen,
        })),
      }
    : null;

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
        conFiltroDeCohorte
          ? `${elegida ? `Cohorte ${elegida.codigo}` : "Todas las cohortes"} · ${rangoLegible}`
          : vista.cohorte
            ? `Cohorte ${vista.cohorte.codigo} · ${rangoLegible}`
            : `Sin cohorte activa · ${rangoLegible}`
      }
      fija
    >
      <PantallaFija>
        <div className="flex flex-wrap items-center gap-2">
          <Pestanas grupos={[{ pestanas }]} activa={seccion} etiqueta="Sección del Hub" />
          {esHoy ? null : (
            <div className="ml-auto min-w-0 max-w-full">
              <FiltroDashboard
                periodo={vista.periodo}
                anteriorDisponible={vista.anteriorDisponible}
                claveCloser={vista.claveCloser}
                closers={veEquipo ? vista.closers : []}
                filtraCloser={veEquipo}
                cohorte={conFiltroDeCohorte ? { valor: elegida?.id ?? TODAS_LAS_COHORTES, opciones } : undefined}
                lineaDeCohorte={lineaDeCohorte}
              />
            </div>
          )}
        </div>

        <div className={clasesDeZonaConScroll()}>
          {seccion === "origen" ? (
            <SeccionOrigen programId={programa.id} slug={programa.slug} rango={vista.seleccion.rango} periodo={vista.periodo} hoy={hoy} origen={origen} puedeAbrirLista={veEquipo} />
          ) : seccion === "pauta" ? (
            <SeccionPauta
              programId={programa.id}
              slug={programa.slug}
              rango={vista.seleccion.rango}
              periodo={vista.periodo}
              origen={origen}
              hoy={hoy}
              busqueda={busqueda}
              enlaceLista={veTableroDelPrograma(rol) ? (metrica, { escalon, pago, ...filtrosDeOrigen }) => metrica === "escalera"
                ? urlDeLista({ slug: programa.slug, metrica, periodo: { ...vista.periodo, b: null }, origen, filtrosDeOrigen, escalera: { escalon, pago } })
                : urlDeLista({ slug: programa.slug, metrica, periodo: { ...vista.periodo, b: null }, origen, filtrosDeOrigen }) : undefined}
            />
          ) : sinActividad ? (
            <p role="status" className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
              {fraseSinActividad(elegida?.codigo ?? null, vista.periodo)}
            </p>
          ) : seccion === "comercial" ? (
            <div className="space-y-4">
            <DashboardPrograma
              seccion="operacion"
              vista={vista}
              detalles={detalles}
              detallesOperacion={proyectar(await detallesDeOperacion(
                { programId: programa.id, slug, hoy, periodo: vista.periodo, cohorteId, origen },
                vista.comparativo.map((fila) => fila.clave),
              ))}
              slug={slug}
              origen={origen}
              veEquipo={veEquipo}
              hoy={hoy}
              dealsContraAgendasVista={vistaComercial!.dealsContraAgendas}
              detalleRegistros={vistaComercial!.detalleRegistros}
              dealsContraAgendas={
                <DealsContraAgendas
                  vista={vistaComercial!.dealsContraAgendas}
                  origen={origen}
                  hoy={hoy}
                  contexto={contextoDeCifra({
                    cohorte: elegida?.codigo ?? null,
                    rango: vista.seleccion.rango,
                    hoy,
                    closer: null,
                  })}
                />
              }
              escalera={
                <Escalera
                  contexto={contextoDeCifra({
                    cohorte: elegida?.codigo ?? null,
                    rango: vista.seleccion.rango,
                    hoy,
                    closer: vista.closers.find((c) => c.id === vista.claveCloser)?.label ?? null,
                  })}
                  periodo={vista.periodo}
                  vista={await vistaDeEscalera({
                    programId: programa.id,
                    slug,
                    hoy,
                    periodo: vista.periodo,
                    claveCloser: vista.claveCloser,
                    cohorteId,
                    cohorteIdDeB,
                    origen,
                    conEquipo: veEquipo,
                  })}
                />
              }
            />
            </div>
          ) : seccion === "dinero" ? (
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
              seriesDinero={await leerSeriesDeDinero({
                programId: programa.id,
                // El eje es el periodo elegido y A y B cada uno con su cohorte (370): sin meses fijos.
                a: { rango: vista.periodo.a, cohorteId },
                b: vista.periodo.b ? { rango: vista.periodo.b, cohorteId: cohorteIdDeB } : null,
                claveCloser: vista.claveCloser,
                hoy,
              })}
            />
          ) : (
            <>
              {fechaRechazada ? (
                <p role="alert" className="mb-3 rounded-md border border-tono-peligro/40 px-3 py-2 text-sm text-tono-peligro">
                  Esa fecha no es válida (no puede ser futura): se muestra hoy.
                </p>
              ) : null}
              <Hoy
                programas={[{
                  programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre },
                  reporte: vistaDeHoy!,
                  detalles,
                  detallesOperacion: veEquipo ? await detallesDeOperacion(
                    { programId: programa.id, slug, hoy: hoyDeLaPestana, periodo: vista.periodo, cohorteId, origen },
                    vista.comparativo.map((fila) => fila.clave),
                  ) : undefined,
                  ...listasDeHoy,
                }]}
                dia={diaDelReporte}
                hoy={hoy}
                selector={<SelectorDeDia dia={diaDelReporte} hoy={hoy} base={{ path: base, params: {} }} />}
                vamosALlegar={<VamosALlegar programa={{ id: programa.id, slug: programa.slug, nombre: programa.nombre }} hoy={diaDelReporte} origen={origen} conListas={veEquipo} configurar={configurar} />}
                vista={vista}
                detalles={detalles}
                alertas={await alertasDelPrograma(programa.id, hoy)}
                slug={slug}
                veEquipo={veEquipo}
                // Lo que era la página Metas (ADR 0086 punto 1). Sus listas son del equipo comercial:
                // sin él (paid trafficker) las cifras salen como texto.
                metas={<SeccionMetas programId={programa.id} slug={slug} hoy={hoy} busqueda={busqueda} origen={origen} conListas={veEquipo} configurar={configurar} />}
                detalleManana={detalleManana}
                configuracion={datosConfiguracionHoy ? <ConfiguracionHoy datos={datosConfiguracionHoy} /> : undefined}
                definirObjetivo={datosConfiguracionHoy ? <ConfiguracionHoy datos={datosConfiguracionHoy} enlace /> : undefined}
              />
            </>
          )}
          {/* El norte (371): al pie de TODAS las pestañas y sin leer los filtros: solo programa y hoy. */}
          {/* En Hoy va dentro del reporte (secciones 4 y 5): no se repite abajo. */}
          {esHoy ? null : <div className="mt-6">
            <VamosALlegar programa={{ id: programa.id, slug: programa.slug, nombre: programa.nombre }} hoy={hoy} origen={origen} conListas={veEquipo} configurar={configurar} />
          </div>}
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
  slug,
  rango,
  periodo,
  origen,
  hoy,
  busqueda,
  enlaceLista,
}: {
  programId: string;
  slug: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  origen: string;
  hoy: string;
  busqueda: Record<string, string | string[] | undefined>;
  enlaceLista?: EnlaceDeLista;
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
  const [pauta, roas] = await Promise.all([
    pautaInterina(db, programId, rango, filtrosPauta, hoy),
    cargarRoasDePauta(db, programId, rango, hoy),
  ]);
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
  const enlaceRoas = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => urlDeLista({
    slug, metrica: "pauta_meta", periodo: { ...periodo, b: null }, origen, pauta: { nivel, id, paso },
  });
  const csv = new URLSearchParams({ periodo: "custom", a_desde: rango.desde, a_hasta: rango.hasta, sin_b: "1" });

  return (
    <section className="space-y-4">
      <SemaforoDelPrograma programId={programId} />
      <PautaInterina vista={pauta} filtros={filtrosPauta} hrefCon={hrefConFiltros} enlaceLista={enlaceLista} />
      <PautaRoas vista={roas} enlace={enlaceRoas} hrefCsv={`/p/${encodeURIComponent(slug)}/hub/pauta-citas.csv?${csv}`} />
    </section>
  );
}

/** Origen explica la clasificación y conserva juntos los cuatro bloques trasladados de Pauta. */
async function SeccionOrigen({ programId, slug, rango, periodo, hoy, origen, puedeAbrirLista }: {
  programId: string;
  slug: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  hoy: string;
  origen: string;
  puedeAbrirLista: boolean;
}) {
  const [vistaOrigen, formulario, porPregunta] = await Promise.all([
    origenDelPrograma(db, { programId, rango, hoy }),
    embudoDelFormulario(db, { programId, rango }),
    embudoPorPregunta(db, programId),
  ]);
  return <section className="space-y-4">
    <Origen vista={vistaOrigen} slug={slug} periodo={periodo} origen={origen} />
    <EmbudoFormulario
      embudo={formulario}
      hrefNoAgendaron={puedeAbrirLista ? urlDeLista({ slug, metrica: "no_agendaron", periodo, origen }) : undefined}
    />
    <EmbudoPorPregunta embudos={porPregunta} />
  </section>;
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
  origen,
  conListas,
  configurar,
}: {
  programId: string;
  slug: string;
  hoy: string;
  busqueda: Record<string, string | string[] | undefined>;
  origen: string;
  conListas: boolean;
  configurar: { hrefBase: string; origen: string } | null;
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
  const hrefVentasMes = urlDeLista({ slug, metrica: "cierres", periodo: periodoDe(metas.periodoMes), origen });
  const hrefVentasSemana = metas.compensacionSemanal
    ? urlDeLista({ slug, metrica: "cierres", periodo: periodoDe({ desde: metas.compensacionSemanal.desde, hasta: metas.compensacionSemanal.hasta }), origen })
    : null;

  return (
    <section id="metas" className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Objetivos de {nombreDelMes(mes)}</h2>
        <nav aria-label="Cambiar mes" className="flex items-center gap-2">
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={hrefMes(anterior)}>← {nombreDelMes(anterior)}</Link>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={hrefMes(siguiente)}>{nombreDelMes(siguiente)} →</Link>
        </nav>
      </div>
      <MetasDelMes metas={metas} hrefVentasMes={hrefVentasMes} hrefVentasSemana={hrefVentasSemana} conListas={conListas} configurar={configurar} />
    </section>
  );
}
