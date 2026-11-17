import { desc } from "drizzle-orm";
import type { Rol } from "@/lib/auth/roles";
import { veEquipoComercial } from "@/lib/auth/roles";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { pautaSincronizaciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { sumarDias } from "@/lib/dias-habiles";
import { fechaCorta, monto, usd } from "@/lib/format";
import type { SeccionDelHub } from "@/lib/nav";
import { vistaDePauta } from "@/lib/pauta/vista-de-pauta";
import { alertasDelPrograma } from "@/lib/queries/alertas";
import { leerConfiguracionDeHoy } from "@/lib/queries/configuracion-de-hoy";
import { dineroDelRango } from "@/lib/queries/dashboard";
import { cargarEmbudoComercial, type OrigenEmbudoComercial } from "@/lib/queries/embudo-comercial";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { embudoPorPregunta } from "@/lib/queries/embudo-por-pregunta";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { origenDelPrograma } from "@/lib/queries/origen";
import { calcularProyeccionDeRoas, proyeccionesConfirmadas } from "@/lib/queries/proyeccion-roas";
import type { ReporteDiario } from "@/lib/queries/reporte-diario";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { vistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import {
  armarVistaDelDashboard,
  type ContextoDeVista,
  type EntradaDeVista,
  type VistaDelDashboard,
} from "@/lib/queries/vista-dashboard";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import {
  detalleDeCifra,
  detallesDeOperacion,
  detallesDelDashboard,
  proyectarDashboardSegunRol,
} from "@/lib/queries/vista-metrica";
import type { VentanaRitmo } from "@/lib/queries/proyeccion";

export type SeccionDelHubDelPrograma = SeccionDelHub;

export interface EntradaDeDatosDelHubDelPrograma {
  programa: { id: string; slug: string; nombre: string };
  rol: Rol;
  busqueda: Record<string, string | string[] | undefined>;
  seccion: SeccionDelHubDelPrograma;
  hoy: string;
  diaDelReporte: string;
  hoyDeLaPestana: string;
  ventanaRitmo: VentanaRitmo;
  entradaDeVista: EntradaDeVista;
  contexto: ContextoDeVista;
  reporteDeHoy: Promise<ReporteDiario> | null;
  origen: string;
  configurar: { hrefBase: string; origen: string } | null;
}

export async function cargarDatosDelHubDelPrograma(db: Db, entrada: EntradaDeDatosDelHubDelPrograma) {
  if (entrada.seccion === "pauta") return cargarDatosDePauta(db, entrada);

  const {
    programa, rol, busqueda, seccion, hoy, diaDelReporte, hoyDeLaPestana,
    entradaDeVista, contexto, reporteDeHoy, origen, configurar,
  } = entrada;
  const slug = programa.slug;
  const esHoy = seccion === "hoy";
  const veEquipo = veEquipoComercial(rol);
  const proyectar = <T,>(valor: T): T => proyectarDashboardSegunRol(valor, rol);

  const seriesDeDineroPendientes = seccion === "dinero"
    ? leerSeriesDeDinero({
        programId: programa.id,
        a: { rango: contexto.periodo.a, cohorteId: contexto.filtroDeCohorte.cohorteId },
        b: contexto.periodo.b ? { rango: contexto.periodo.b, cohorteId: contexto.filtroDeCohorte.cohorteIdDeB } : null,
        claveCloser: contexto.claveCloser,
        hoy,
      }, db)
    : undefined;
  seriesDeDineroPendientes?.catch(() => undefined);

  const vistaDeHoy = reporteDeHoy ? await reporteDeHoy : null;
  const vista = vistaDeHoy?.vista ?? await armarVistaDelDashboard(entradaDeVista, db, contexto);
  const cohorteId = esHoy ? null : vista.filtroDeCohorte.cohorteId;
  const cohorteIdDeB = esHoy ? null : vista.filtroDeCohorte.cohorteIdDeB;
  const { elegida } = vista.filtroDeCohorte;
  const sinActividad = seccion !== "hoy" && elegida !== null
    && vista.embudo.agendas === 0 && vista.embudo.cierres === 0 && vista.caja.length === 0
    && (vista.leads.leads ?? 0) === 0 && vista.cortesias === 0;

  const entradaDetalles = {
    programId: programa.id, slug, hoy: hoyDeLaPestana, periodo: vista.periodo,
    claveCloser: vista.claveCloser, cohorteId, origen,
  };
  const comparativoClaves = vista.comparativo.map((fila) => fila.clave);
  const periodoDelDia = { preset: "custom" as const, a: { desde: diaDelReporte, hasta: diaDelReporte }, b: null };
  const listaDelDia = (metrica: "leads" | "citas_debidas" | "citas_sin_marcar") =>
    detalleDeCifra(metrica, {
      programId: programa.id, slug, hoy: diaDelReporte, periodo: periodoDelDia,
      claveCloser: null, origen,
    }, db);

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
    detallesDelDashboard(entradaDetalles, db),
    esHoy
      ? detalleDeCifra("agendas", {
          programId: programa.id, slug, hoy,
          periodo: { preset: "custom", a: { desde: sumarDias(hoy, 1), hasta: sumarDias(hoy, 1) }, b: null },
          claveCloser: null, origen,
        }, db)
      : undefined,
    esHoy ? listaDelDia("leads") : undefined,
    esHoy ? listaDelDia("citas_debidas") : undefined,
    esHoy ? listaDelDia("citas_sin_marcar") : undefined,
    (esHoy && veEquipo) || (seccion === "comercial" && !sinActividad)
      ? detallesDeOperacion(
          { programId: programa.id, slug, hoy: hoyDeLaPestana, periodo: vista.periodo, cohorteId, origen },
          comparativoClaves,
          db,
        )
      : undefined,
    seccion === "comercial" && !sinActividad
      ? cargarVistaComercial(db, { programa, busqueda, vista, cohorteId, cohorteIdDeB, origen, hoy, veEquipo, rol })
      : null,
    esHoy ? alertasDelPrograma(programa.id, hoy, db) : undefined,
    esHoy && configurar ? leerConfiguracionDeHoy(programa.id, db) : null,
  ]);

  const detalles = proyectar(detallesCrudos);
  const detalleManana = esHoy ? proyectar(detalleMananaCrudo) : undefined;
  const detallesOperacion = detallesOperacionCrudos ? proyectar(detallesOperacionCrudos) : undefined;
  if (seccion === "comercial") {
    const evidencia = veEquipo && !sinActividad ? Object.fromEntries(await Promise.all(
      (["agendas", "grupo_citas", "grupo_shows", "grupo_pendientes"] as const).map(async (metrica) => {
        const [lista] = await listaDeMetrica(metrica, {
          programId: programa.id, hoy, rango: vista.periodo.a, claveCloser: vista.claveCloser, cohorteId,
        }, 1, db);
        return [metrica, lista.filas.slice(0, 5).map((fila) => [fila.persona?.nombre ?? "Sin nombre", fechaCorta(fila.fecha)])] as const;
      }),
    )) : undefined;
    return { seccion, vista, cohorteId, sinActividad, detalles, detallesOperacion, vistaComercial, evidencia } as const;
  }

  if (seccion === "dinero") {
    const detallesPorCohorte = Object.fromEntries(await Promise.all(
      (veEquipo && !sinActividad ? vista.ventasPorCohorte : []).flatMap((fila) => fila.cohorteId ? [fila.cohorteId] : [])
        .map(async (id) => [id, await detalleDeCifra("contratado", { ...entradaDetalles, cohorteId: id }, db)] as const),
    ));
    const evidencia = veEquipo && !sinActividad ? Object.fromEntries(await Promise.all(
      (["contratado", "caja"] as const).map(async (metrica) => {
        const [lista] = await listaDeMetrica(metrica, {
          programId: programa.id, hoy, rango: vista.periodo.a, claveCloser: vista.claveCloser, cohorteId,
        }, 1, db);
        return [metrica, lista.filas.slice(0, 5).map((fila) => [
          fila.persona?.nombre ?? "Sin nombre", fechaCorta(fila.fecha),
          fila.monto === null ? "—" : metrica === "caja" ? monto(fila.monto, fila.moneda ?? "USD") : usd(fila.monto),
        ])] as const;
      }),
    )) : undefined;
    return { seccion, vista, cohorteId, sinActividad, detalles, detallesPorCohorte, evidencia, seriesDeDinero: seriesDeDineroPendientes } as const;
  }

  const reporte = vistaDeHoy!;
  const evidenciaDeHoy = veEquipo ? Object.fromEntries(await Promise.all(
    (["agendas", "shows", "canceladas", "cierres", "grupo_pendientes", "caja"] as const).map(async (metrica) => {
      const [lista] = await listaDeMetrica(metrica, {
        programId: programa.id, hoy: diaDelReporte, rango: periodoDelDia.a,
        claveCloser: null, cohorteId: null, ahora: reporte.corte,
      }, 1, db);
      return [metrica, lista.filas.slice(0, 5).map((fila) => [
        fila.persona?.nombre ?? "Sin nombre", fechaCorta(fila.fecha),
        fila.monto === null ? "—" : monto(fila.monto, fila.moneda ?? "USD"),
      ])] as const;
    }),
  )) : undefined;
  return {
    seccion, vista, vistaDeHoy, cohorteId, sinActividad, detalles, detalleManana, detallesOperacion,
    detalleRegistros: proyectar(detalleRegistros!),
    detalleCitasDebidas: proyectar(detalleCitasDebidas!),
    detalleCitasSinMarcar: proyectar(detalleCitasSinMarcar!),
    alertas, configuracionCruda, evidenciaDeHoy,
  } as const;
}

async function cargarVistaComercial(
  db: Db,
  { programa, busqueda, vista, cohorteId, cohorteIdDeB, origen, hoy, veEquipo, rol }: {
    programa: { id: string; slug: string };
    busqueda: Record<string, string | string[] | undefined>;
    vista: VistaDelDashboard;
    cohorteId: string | null;
    cohorteIdDeB: string | null;
    origen: string;
    hoy: string;
    veEquipo: boolean;
    rol: Rol;
  },
) {
  const slug = programa.slug;
  const origenPedido = texto(busqueda.origen);
  const origenEmbudo = origenPedido === "completo" || origenPedido === "parcial" ? origenPedido : "todos";
  const filtroDeOrigen: OrigenEmbudoComercial | undefined = origenEmbudo === "todos" ? undefined : origenEmbudo;
  const datos = { programId: programa.id, slug, hoy, periodo: vista.periodo, claveCloser: vista.claveCloser, cohorteId, origen };
  const metricas = ["embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_shows", "embudo_comercial_compraron"] as const;
  const [dealsContraAgendas, pasos, detallesEmbudo, escalera, dineroPorCloser] = await Promise.all([
    vistaDealsContraAgendas({ ...datos, cohorteIdDeB }, db),
    cargarEmbudoComercial(db, { programId: programa.id, rango: vista.periodo.a, claveCloser: vista.claveCloser, cohorteId }, filtroDeOrigen),
    Promise.all(metricas.map((metrica) => detalleDeCifra(metrica, { ...datos, origenDeal: filtroDeOrigen }, db))),
    vistaDeEscalera({ ...datos, cohorteIdDeB, conEquipo: veEquipo }, db),
    Promise.all((veEquipo ? vista.comparativo : []).map(async (fila) => [
      fila.clave,
      await dineroDelRango({ programId: programa.id, rango: vista.periodo.a, claveCloser: fila.clave, cohorteId }, db),
    ] as const)),
  ]);
  const enlacesDeOrigen = Object.fromEntries((["todos", "completo", "parcial"] as const).map((valor) => {
    const url = new URL(origen, "http://retia.local");
    if (valor === "todos") url.searchParams.delete("origen");
    else url.searchParams.set("origen", valor);
    return [valor, `${url.pathname}${url.search}`];
  })) as Record<"todos" | "completo" | "parcial", string>;
  const proyectar = <T,>(valor: T): T => proyectarDashboardSegunRol(valor, rol);
  return {
    dealsContraAgendas: proyectar(dealsContraAgendas),
    embudo: proyectar(pasos.map((paso, indice) => ({
      ...paso,
      detalle: detallesEmbudo[indice],
      detallePerdidos: indice > 0 ? detallesEmbudo[indice - 1] : undefined,
    }))),
    origenEmbudo: origenEmbudo as "todos" | "completo" | "parcial",
    enlacesDeOrigen,
    escalera: proyectar(escalera),
    dineroPorCloser: Object.fromEntries(dineroPorCloser),
  };
}

async function cargarDatosDePauta(db: Db, entrada: EntradaDeDatosDelHubDelPrograma) {
  const { programa, busqueda, hoy, contexto } = entrada;
  const ahora = new Date();
  const [ultimaSincronizacion] = await db
    .select({ inicio: pautaSincronizaciones.inicio })
    .from(pautaSincronizaciones)
    .orderBy(desc(pautaSincronizaciones.inicio))
    .limit(1);
  const vista = vistaDePauta(busqueda.vista);

  if (vista === "resultados") {
    const [roas, objetivosDeLaCohorte] = await Promise.all([
      cargarRoasDePauta(db, programa.id, contexto.seleccion.rango, hoy, ahora),
      contexto.filtroDeCohorte.elegida?.id
        ? objetivosDeCohortes(db, [contexto.filtroDeCohorte.elegida.id])
        : Promise.resolve([]),
    ]);
    const [proyeccion, historial] = await Promise.all([
      calcularProyeccionDeRoas(db, { programId: programa.id, rango: contexto.seleccion.rango, hoy, ahora, vista: roas }),
      proyeccionesConfirmadas(db, programa.id),
    ]);
    return { seccion: "pauta", vista, ahora, ultimaSincronizacion, roas, objetivosDeLaCohorte, proyeccion, historial } as const;
  }

  const [roas, vistaOrigen, formulario, porPregunta] = await Promise.all([
    cargarRoasDePauta(db, programa.id, contexto.seleccion.rango, hoy, ahora),
    origenDelPrograma(db, { programId: programa.id, rango: contexto.seleccion.rango, hoy }),
    embudoDelFormulario(db, { programId: programa.id, rango: contexto.seleccion.rango }),
    embudoPorPregunta(db, programa.id),
  ]);
  return { seccion: "pauta", vista, ahora, ultimaSincronizacion, roas, vistaOrigen, formulario, porPregunta } as const;
}

function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

export type DatosDelHubDelPrograma = Awaited<ReturnType<typeof cargarDatosDelHubDelPrograma>>;
