import { desc } from "drizzle-orm";
import { AREAS } from "@/lib/atribucion/canal";
import type { Rol } from "@/lib/auth/roles";
import { veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { pautaSincronizaciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { sumarDias } from "@/lib/dias-habiles";
import { fechaCorta, monto, usd } from "@/lib/format";
import type { SeccionDelHub } from "@/lib/nav";
import { vistaDePauta } from "@/lib/pauta/vista-de-pauta";
import type { CortePauta } from "@/lib/queries/atribucion-de-pauta";
import { alertasDelPrograma } from "@/lib/queries/alertas";
import { leerConfiguracionDeHoy } from "@/lib/queries/configuracion-de-hoy";
import { dineroPorCloserDelRango } from "@/lib/queries/dashboard";
import {
  cargarEmbudoComercial,
  type AreaEmbudoComercial,
  type OrigenEmbudoComercial,
} from "@/lib/queries/embudo-comercial";
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
  type DetalleDeCifra,
} from "@/lib/queries/vista-metrica";
import type { VentanaRitmo } from "@/lib/queries/proyeccion";

export type SeccionDelHubDelPrograma = SeccionDelHub;

export interface EntradaDeDatosDelHubDelPrograma {
  programa: { id: string; slug: string; nombre: string };
  rol: Rol | null;
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
  /** «Ver solo» de Pauta (420), ya validado contra el programa; nulo es todo el programa. */
  corte?: CortePauta | null;
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
    && vista.embudo.agendas === 0 && vista.embudo.cierres === 0 && vista.caja.every((c) => c.total === 0)
    && (vista.leads.leads ?? 0) === 0 && vista.cortesias === 0;

  const entradaDetalles = {
    programId: programa.id, slug, hoy: hoyDeLaPestana, periodo: vista.periodo,
    claveCloser: vista.claveCloser, cohorteId, ...vista.filtrosDeSku, origen,
  };
  const comparativoClaves = vista.comparativo.map((fila) => fila.clave);
  const dineroPorCloserPendiente = seccion === "comercial" && !sinActividad && veEquipo
    ? dineroPorCloserDelRango(
        { programId: programa.id, rango: vista.periodo.a, cohorteId },
        comparativoClaves,
        db,
      )
    : undefined;
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
          dineroPorCloserPendiente,
        )
      : undefined,
    seccion === "comercial" && !sinActividad
      ? cargarVistaComercial(db, {
          programa, busqueda, vista, cohorteId, cohorteIdDeB, origen, hoy, veEquipo, rol, dineroPorCloserPendiente,
        })
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
    seccion, vista, vistaDeHoy: reporte, cohorteId, sinActividad, detalles, detalleManana, detallesOperacion,
    detalleRegistros: proyectar(detalleRegistros!),
    detalleCitasDebidas: proyectar(detalleCitasDebidas!),
    detalleCitasSinMarcar: proyectar(detalleCitasSinMarcar!),
    alertas, configuracionCruda, evidenciaDeHoy,
  } as const;
}

async function cargarVistaComercial(
  db: Db,
  { programa, busqueda, vista, cohorteId, cohorteIdDeB, origen, hoy, veEquipo, rol, dineroPorCloserPendiente }: {
    programa: { id: string; slug: string };
    busqueda: Record<string, string | string[] | undefined>;
    vista: VistaDelDashboard;
    cohorteId: string | null;
    cohorteIdDeB: string | null;
    origen: string;
    hoy: string;
    veEquipo: boolean;
    rol: Rol | null;
    dineroPorCloserPendiente?: ReturnType<typeof dineroPorCloserDelRango>;
  },
) {
  const slug = programa.slug;
  const origenPedido = texto(busqueda.origen);
  const origenEmbudo = origenPedido === "completo" || origenPedido === "parcial" ? origenPedido : "todos";
  const filtroDeOrigen: OrigenEmbudoComercial | undefined = origenEmbudo === "todos" ? undefined : origenEmbudo;
  const areaPedida = texto(busqueda.area);
  const areaEmbudo: AreaEmbudoComercial | "todas" = AREAS.find((area) => area === areaPedida) ?? "todas";
  const filtroDeArea: AreaEmbudoComercial | undefined = areaEmbudo === "todas" ? undefined : areaEmbudo;
  const datos = { programId: programa.id, slug, hoy, periodo: vista.periodo, claveCloser: vista.claveCloser, cohorteId, ...vista.filtrosDeSku, origen };
  const metricas = ["embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_shows", "embudo_comercial_compraron"] as const;
  const [dealsContraAgendas, pasos, detallesEmbudo, escalera, dineroPorCloser] = await Promise.all([
    vistaDealsContraAgendas({ ...datos, cohorteIdDeB }, db),
    cargarEmbudoComercial(
      db, { programId: programa.id, rango: vista.periodo.a, claveCloser: vista.claveCloser, cohorteId },
      filtroDeOrigen, filtroDeArea,
    ),
    Promise.all(metricas.map((metrica) => detalleDeCifra(
      metrica, { ...datos, origenDeal: filtroDeOrigen, area: filtroDeArea }, db,
    ))),
    vistaDeEscalera({ ...datos, cohorteIdDeB, conEquipo: veEquipo }, db),
    dineroPorCloserPendiente ?? Promise.resolve(new Map()),
  ]);
  const enlacesDeOrigen = Object.fromEntries((["todos", "completo", "parcial"] as const).map((valor) => {
    const url = new URL(origen, "http://retia.local");
    if (valor === "todos") url.searchParams.delete("origen");
    else url.searchParams.set("origen", valor);
    return [valor, `${url.pathname}${url.search}`];
  })) as Record<"todos" | "completo" | "parcial", string>;
  const enlacesDeArea = Object.fromEntries(([
    "todas", "paid", "organico", "referidos", "sin_utm",
  ] as const).map((valor) => {
    const url = new URL(origen, "http://retia.local");
    if (valor === "todas") url.searchParams.delete("area");
    else url.searchParams.set("area", valor);
    return [valor, `${url.pathname}${url.search}`];
  })) as Record<"todas" | AreaEmbudoComercial, string>;
  const proyectar = <T,>(valor: T): T => proyectarDashboardSegunRol(valor, rol);
  // Solo los detalles del embudo comercial (sus listas) se conservan para quien ve el tablero aunque no vea el
  // equipo comercial: pauta abre esas cuatro listas (ADR 0138). Todo lo demás de Comercial sigue cerrado.
  // Para pauta queda el enlace y el conteo: sin los grupos ni el desglose por closer, que llevan closer y monto (ADR 0052).
  const proyectarDetalleDelEmbudo = <T extends DetalleDeCifra | undefined>(valor: T): T =>
    !valor || veEquipoComercial(rol) || !veTableroDelPrograma(rol) ? proyectarDashboardSegunRol(valor, rol) : {
      ...valor,
      resumen: { ...valor.resumen, dinero: undefined, grupos: [] },
      desgloses: { ...valor.desgloses, porCloser: [] },
    };
  return {
    dealsContraAgendas: proyectar(dealsContraAgendas),
    embudo: pasos.map((paso, indice) => ({
      ...paso,
      detalle: proyectarDetalleDelEmbudo(detallesEmbudo[indice]),
      detallePerdidos: indice > 0 ? proyectarDetalleDelEmbudo(detallesEmbudo[indice - 1]) : undefined,
    })),
    origenEmbudo: origenEmbudo as "todos" | "completo" | "parcial",
    enlacesDeOrigen,
    areaEmbudo,
    enlacesDeArea,
    escalera: proyectar(escalera),
    dineroPorCloser: Object.fromEntries(dineroPorCloser),
  };
}

async function cargarDatosDePauta(db: Db, entrada: EntradaDeDatosDelHubDelPrograma) {
  const { programa, busqueda, hoy, contexto } = entrada;
  const corte = entrada.corte ?? null;
  const ahora = new Date();
  const [ultimaSincronizacion] = await db
    .select({ inicio: pautaSincronizaciones.inicio })
    .from(pautaSincronizaciones)
    .orderBy(desc(pautaSincronizaciones.inicio))
    .limit(1);
  const vista = vistaDePauta(busqueda.vista);

  if (vista === "resultados") {
    const [roas, objetivosDeLaCohorte] = await Promise.all([
      cargarRoasDePauta(db, programa.id, contexto.seleccion.rango, hoy, ahora, null, corte),
      contexto.filtroDeCohorte.elegida?.id
        ? objetivosDeCohortes(db, [contexto.filtroDeCohorte.elegida.id])
        : Promise.resolve([]),
    ]);
    const [proyeccion, historial] = await Promise.all([
      calcularProyeccionDeRoas(db, { programId: programa.id, rango: contexto.seleccion.rango, hoy, ahora, vista: roas, tasasDelPrograma: corte !== null }),
      proyeccionesConfirmadas(db, programa.id),
    ]);
    return { seccion: "pauta", vista, ahora, ultimaSincronizacion, roas, objetivosDeLaCohorte, proyeccion, historial } as const;
  }

  const [roas, vistaOrigen, formulario, porPregunta] = await Promise.all([
    cargarRoasDePauta(db, programa.id, contexto.seleccion.rango, hoy, ahora, null, corte),
    origenDelPrograma(db, { programId: programa.id, rango: contexto.seleccion.rango, hoy }),
    embudoDelFormulario(db, { programId: programa.id, rango: contexto.seleccion.rango }),
    embudoPorPregunta(db, programa.id),
  ]);
  // «¿Qué llega sin origen?» no sigue «Ver solo»: con corte lee además el ROAS de todo el programa.
  const roasDelDiagnostico = corte ? await cargarRoasDePauta(db, programa.id, contexto.seleccion.rango, hoy, ahora) : roas;
  return { seccion: "pauta", vista, ahora, ultimaSincronizacion, roas, roasDelDiagnostico, vistaOrigen, formulario, porPregunta } as const;
}

function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

export type DatosDelHubDelPrograma = Awaited<ReturnType<typeof cargarDatosDelHubDelPrograma>>;
