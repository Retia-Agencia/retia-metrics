import { z } from "zod";
import { esAdministrador, veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota, monto, num, pct } from "@/lib/format";
import { parsearPeriodoUrl } from "@/lib/periodo";
import {
  capacidadParaMetrica,
  desglosesDelResumen,
  proyectarListaSegunRol,
  TAMANO_PAGINA,
} from "@/lib/queries/metricas-con-filas";
import { camposDeFiltrosDeLista, combinacionDeFiltrosValida, METRICAS_DE_LISTA, normalizarFiltrosDeOrigen, tipoDeLista } from "@/lib/queries/filtros-de-lista";
import { armarVistaDelDashboard, cohorteDeLaPauta, resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { nombreDeEtapa, proyectarDashboardSegunRol, vistaDeLista } from "@/lib/queries/vista-metrica";
import type { Herramienta } from "./tipos";
import { programaVisible } from "./programa";
import { enlaceDeDeal, enlaceDeLead, enlaceDeSeccionHub } from "@/lib/mcp/enlaces";
import { busquedaDePeriodoMcp, camposDePeriodoMcp, presetDePeriodoMcp } from "./periodo";
import { nombreCorto, nombreLargo, TITULOS_DE_LISTA } from "@/lib/vocabulario-metricas";
import { aSalidaDeResumen, salidaDeResumen } from "@/lib/mcp/salidas/resumen";
import { salidaDeConsultaDeMetrica } from "@/lib/mcp/salidas/metrica";
import { textoDeRazon, type RazonConCobertura } from "@/lib/cobertura";
import { cargarPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { vistaDeEscalera } from "@/lib/queries/vista-escalera";
import { leerProyeccion, ventanaRitmoDeUrl } from "@/lib/queries/proyeccion";
import { leerCumplimientoDeCohorte } from "@/lib/metas/cumplimiento-de-cohorte";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { calcularProyeccionDeRoas } from "@/lib/queries/proyeccion-roas";
import { sumarDias } from "@/lib/dias-habiles";
import type { HechoConsultable } from "@/lib/queries/hechos/registro";
import { consultarHechosMcp } from "./hechos";
import type { CLAVES_DE_SIGUIENTE_PASO } from "@/lib/mcp/salidas/metrica";

function tasaLegible(nombre: string, razon: RazonConCobertura, cobertura: number | null, parcial: boolean): string {
  return `${nombre}: ${textoDeRazon(razon, pct)} · cobertura ${cobertura === null ? "—" : pct(cobertura)}${parcial ? " (parcial)" : ""}`;
}

type ArgumentoDePaso = string | number | string[];
interface SiguientePaso {
  clave: (typeof CLAVES_DE_SIGUIENTE_PASO)[number];
  texto: string;
  herramienta: string | null;
  argumentos: Record<string, ArgumentoDePaso>;
  enlace: string | null;
}

/**
 * El hecho (y su dimension de origen) que abre una metrica por canal o campana. Solo las metricas que son
 * el conteo de un hecho: una lista con otro universo (p. ej. citas_debidas) no se abre por aqui.
 */
const DESGLOSE_DE_ORIGEN: Partial<Record<(typeof METRICAS_DE_LISTA)[number], { hecho: HechoConsultable; dimension: string; texto: string }>> = {
  cierres: { hecho: "venta", dimension: "canal", texto: "Abrir las ventas por canal" },
  agendas: { hecho: "agenda", dimension: "canal", texto: "Abrir las agendas por canal" },
  shows: { hecho: "cita", dimension: "canal", texto: "Abrir los shows por canal" },
  caja: { hecho: "abono", dimension: "plataforma", texto: "Abrir lo que entró a caja por plataforma de pago" },
  registros: { hecho: "envio", dimension: "campana", texto: "Abrir los registros por campaña" },
};

/** El periodo inmediatamente anterior, de la misma duracion, en dias de Bogota (AAAA-MM-DD). */
export function periodoAnteriorDe(desde: string, hasta: string): { desde: string; hasta: string } {
  const dias = Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
  return { desde: sumarDias(desde, -dias), hasta: sumarDias(desde, -1) };
}

/** Los pasos proactivos de una consulta (407, ADR 0135): solo los que la herramienta destino permite a este rol. */
export function siguientesPasosDeMetrica(
  contexto: Parameters<typeof consultarMetricaMcp.ejecutar>[0],
  entrada: z.infer<typeof entradaMetrica>,
  vista: { desde: string; hasta: string; haySiguiente: boolean; enlace: string },
): SiguientePaso[] {
  const pasos: SiguientePaso[] = [];
  const filtros: Record<string, ArgumentoDePaso> = {};
  for (const [clave, valor] of Object.entries(entrada) as Array<[string, unknown]>) {
    if (["periodo", "desde", "hasta", "pagina"].includes(clave)) continue;
    if (typeof valor === "string" || typeof valor === "number") filtros[clave] = valor;
  }
  const anterior = periodoAnteriorDe(vista.desde, vista.hasta);
  pasos.push({
    clave: "comparar_periodo_anterior",
    texto: `Comparar con el periodo anterior (${anterior.desde} a ${anterior.hasta}, misma duración)`,
    herramienta: "consultar_metrica",
    argumentos: { ...filtros, periodo: "custom", desde: anterior.desde, hasta: anterior.hasta, pagina: 1 },
    enlace: null,
  });
  const desglose = DESGLOSE_DE_ORIGEN[entrada.metrica];
  if (desglose && consultarHechosMcp.puede(contexto)) {
    pasos.push({
      clave: "desglosar_por_origen",
      texto: desglose.texto,
      herramienta: "consultar_hechos",
      argumentos: { programa: entrada.programa, hecho: desglose.hecho, periodo: "custom", desde: vista.desde, hasta: vista.hasta, agrupar_por: [desglose.dimension] },
      enlace: null,
    });
  }
  if (vista.haySiguiente) {
    pasos.push({
      clave: "ver_mas_filas",
      texto: `Ver la página ${entrada.pagina + 1} de filas`,
      herramienta: "consultar_metrica",
      argumentos: { ...filtros, periodo: "custom", desde: vista.desde, hasta: vista.hasta, pagina: entrada.pagina + 1 },
      enlace: null,
    });
  }
  pasos.push({ clave: "abrir_en_el_hub", texto: "Abrir el Hub del programa para verificar la cifra", herramienta: null, argumentos: {}, enlace: vista.enlace });
  return pasos;
}

const entradaResumen = z.object({ programa: z.string().min(1).max(100), ...camposDePeriodoMcp }).strict();

export const resumenDelHubMcp: Herramienta<typeof entradaResumen> = {
  nombre: "resumen_del_hub",
  titulo: "Resumen del Hub",
  descripcion:
    `Úsala cuando necesites las cifras principales del Hub de un programa para un periodo. Devuelve ${nombreCorto("ventas").toLocaleLowerCase()}, ${nombreCorto("vendido").toLocaleLowerCase()}, recaudado, por cobrar, dinero que entró a caja, ${nombreCorto("citas").toLocaleLowerCase()}, ${nombreCorto("shows").toLocaleLowerCase()} y tasas con cobertura. También devuelve la columna Total de Pauta, pérdidas por motivo con ticket perdido en USD, medianas de días hábiles de cita a pago y las proyecciones de Planeación, Cumplimiento y ROAS. ` +
    "Las fechas son días de Bogotá (AAAA-MM-DD), cada monto conserva su moneda y toda tasa informa su cobertura; " +
    "— significa que no se puede calcular. No mezcla programas ni devuelve filas individuales.",
  entrada: entradaResumen,
  salida: salidaDeResumen,
  puede: (contexto) => veTableroDelPrograma(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const programa = await programaVisible(contexto, entrada.programa);
    const hoy = hoyEnBogota();
    const ahora = new Date();
    const periodoPedido = parsearPeriodoUrl(busquedaDePeriodoMcp(entrada));
    const entradaDeVista = { programId: programa.id, hoy, ahora, periodo: periodoPedido, preset: presetDePeriodoMcp(entrada) };
    const contextoDeVista = await resolverContextoDeVista(entradaDeVista, contexto.db);
    const sinProyectar = await armarVistaDelDashboard(entradaDeVista, contexto.db, contextoDeVista);
    const vista = proyectarDashboardSegunRol(sinProyectar, contexto.rol);
    const cohorteDePauta = contextoDeVista.filtroDeCohorte.elegida?.id ?? null;
    const cohorteDeLaTabla = cohorteDeLaPauta(contextoDeVista);
    const ventanaRitmo = ventanaRitmoDeUrl(undefined);
    const [pauta, escalera, planeacion, cumplimiento, roasProyectado] = await Promise.all([
      cargarPautaSemanal(contexto.db, {
        programId: programa.id,
        rango: vista.periodo.a,
        hoy,
        // La misma cohorte que filtra el resto de la vista (D-13): sin filtro de cohorte, «Todas», como la pantalla.
        cohorteId: cohorteDeLaTabla,
        paso: "semana",
        porCuenta: false,
      }),
      vistaDeEscalera({
        programId: programa.id,
        slug: programa.slug,
        hoy,
        periodo: vista.periodo,
        claveCloser: vista.claveCloser,
        cohorteId: vista.filtroDeCohorte.cohorteId,
        cohorteIdDeB: vista.filtroDeCohorte.cohorteIdDeB,
        origen: enlaceDeSeccionHub(programa.slug, "comercial"),
        conEquipo: veEquipoComercial(contexto.rol),
      }, contexto.db),
      leerProyeccion({ programId: programa.id, hoy, ahora, ventanaDiasHabiles: ventanaRitmo }, contexto.db),
      leerCumplimientoDeCohorte(programa.id, cohorteDePauta, hoy, contexto.db),
      (async () => {
        const roas = await cargarRoasDePauta(contexto.db, programa.id, vista.periodo.a, hoy, ahora);
        return calcularProyeccionDeRoas(contexto.db, { programId: programa.id, rango: vista.periodo.a, hoy, ahora, vista: roas });
      })(),
    ]);
    const grupo = vista.embudo.grupo;
    const caja = vista.caja.map((valor) => monto(valor.total, valor.moneda));
    const enlace = enlaceDeSeccionHub(programa.slug, "comercial");
    const lineas = [
      `Programa: ${programa.nombre}`,
      `Periodo: ${vista.periodo.a.desde} a ${vista.periodo.a.hasta} (Bogotá)`,
      `${nombreLargo("ventas")}: ${num(vista.embudo.cierres)}`,
      `${nombreCorto("vendido")}: ${monto(vista.dinero.vendido, "USD")}`,
      `${nombreCorto("entro_a_caja")}: ${caja.join(", ")}`,
      `${nombreCorto("citas")}: ${num(vista.embudo.agendas)} · ${nombreCorto("shows")}: ${num(vista.embudo.llamadasConShow)}`,
      tasaLegible(nombreCorto("asistencia"), vista.embudo.razonShow, grupo.cobertura, grupo.parcial),
      tasaLegible(nombreCorto("cierre_de_ventas"), vista.embudo.razonCierre, grupo.cobertura, grupo.parcial),
      `${nombreCorto("cita_a_venta")}: ${vista.embudo.agendaAVenta === null ? "—" : pct(vista.embudo.agendaAVenta)} · cobertura ${grupo.cobertura === null ? "—" : pct(grupo.cobertura)}${grupo.parcial ? " (parcial)" : ""}`,
      enlace,
    ];
    return {
      texto: lineas.join("\n"),
      estructurado: aSalidaDeResumen(
        vista,
        { hoy, pauta: pauta.filas, escalera, planeacion, cumplimiento, roasProyectado },
        { nombre: programa.nombre, slug: programa.slug },
        enlace,
      ),
    };
  },
};

const entradaMetrica = z.object({
  programa: z.string().min(1).max(100),
  metrica: z.enum(METRICAS_DE_LISTA),
  ...camposDePeriodoMcp,
  pagina: z.number().int().min(1).max(1_000_000).default(1),
  ...camposDeFiltrosDeLista,
}).strict();

export const consultarMetricaMcp: Herramienta<typeof entradaMetrica> = {
  nombre: "consultar_metrica",
  titulo: "Consultar una métrica",
  descripcion:
    "Úsala cuando necesites explicar una métrica del Hub, filtrarla o abrir sus filas. Devuelve su total, desgloses por responsable, etapa y antigüedad, y hasta 50 filas de la página pedida. " +
    "Programa y periodo son obligatorios; las fechas son días de Bogotá. Admite los mismos filtros semánticos de las listas del Hub: origen " +
    "(fuente, medio, categoría, área, canal y campaña), escalera de conversión y jerarquía de pauta; cada filtro solo existe para las métricas donde tiene sentido. " +
    "El filtro closer acepta solo el código opaco que devuelve el CRM. " +
    "Los montos siempre incluyen moneda, — significa que no se puede calcular y la respuesta indica si existe una página siguiente. No mezcla programas ni modifica datos.",
  entrada: entradaMetrica,
  salida: salidaDeConsultaDeMetrica,
  puede: (contexto) => veTableroDelPrograma(contexto.rol) || veEquipoComercial(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const programa = await programaVisible(contexto, entrada.programa);
    const { tieneOrigen, esListaDePauta, esListaDeOrigen } = tipoDeLista(entrada);
    const capacidad = capacidadParaMetrica({ metrica: entrada.metrica, tieneOrigen });
    if (!capacidad(contexto.rol)) throw new ErrorDeApp("No existe ese programa", 404);
    if (!combinacionDeFiltrosValida(entrada, { esAdmin: esAdministrador(contexto.rol) })) {
      throw new ErrorDeApp("No existe esa lista", 404);
    }
    const busqueda = busquedaDePeriodoMcp(entrada);
    const { source, medium, canal, campaign } = normalizarFiltrosDeOrigen(entrada);
    const vista = await vistaDeLista({
      programId: programa.id,
      metrica: entrada.metrica,
      busqueda,
      hoy: hoyEnBogota(),
      codigoCloser: entrada.closer,
      moneda: entrada.moneda,
      nombreDeSku: entrada.nombre_del_sku,
      skuId: entrada.sku,
      origenDeal: entrada.origen,
      etapa: entrada.etapa,
      antiguedad: entrada.antiguedad,
      source,
      medium,
      campaign,
      resultado: entrada.resultado,
      categoria: entrada.categoria,
      tipo: entrada.tipo,
      orden: entrada.orden,
      area: entrada.area,
      canal,
      escalon: entrada.escalon,
      grupo: entrada.grupo,
      calidad: entrada.calidad,
      pago: entrada.pago,
      nivel: entrada.nivel,
      idMeta: entrada.id,
      paso: entrada.paso,
      pagina: entrada.pagina,
    }, contexto.db);
    if (!vista) throw new ErrorDeApp("No existe ese programa", 404);
    const lista = proyectarListaSegunRol(vista.lista, { rol: contexto.rol, metrica: entrada.metrica, esListaDePauta, esListaDeOrigen });
    const desgloses = desglosesDelResumen(lista.grupos, nombreDeEtapa);
    const haySiguiente = entrada.pagina * TAMANO_PAGINA < lista.subtotal.cantidad;
    const montosDeLaLista = lista.subtotal.caja.map((valor) => monto(valor.total, valor.moneda));
    const filas = lista.filas.map((fila) => {
      const enlace = fila.dealId
        ? enlaceDeDeal(programa.slug, fila.dealId)
        : fila.persona
          ? enlaceDeLead(programa.slug, fila.persona.leadId)
          : null;
      const valor = fila.monto === null || fila.moneda === null ? null : { valor: fila.monto, moneda: fila.moneda };
      const recaudado = fila.recaudado === undefined || fila.recaudado === null || fila.moneda === null
        ? null
        : { valor: fila.recaudado, moneda: fila.moneda };
      const porCobrar = fila.porCobrar === undefined || fila.porCobrar === null || fila.moneda === null
        ? null
        : { valor: fila.porCobrar, moneda: fila.moneda };
      return {
        fecha: fila.fecha,
        cita_en: fila.citaEn?.toISOString() ?? null,
        resultado: fila.resultado ?? null,
        responsable: fila.closer,
        codigo_del_responsable: fila.claveCloser,
        etapa: fila.etapa,
        dias_sin_actividad: fila.antiguedad,
        rango_de_antiguedad: fila.bucket,
        valor,
        recaudado,
        por_cobrar: porCobrar,
        concepto: fila.concepto,
        nota: fila.nota,
        cantidad: fila.cantidad,
        persona: fila.persona ? { nombre: fila.persona.nombre, id: fila.persona.leadId } : null,
        ultima_actividad: fila.ultimaActividad ?? null,
        enlace,
      };
    });
    const texto = [
      `${TITULOS_DE_LISTA[entrada.metrica]}: ${lista.disponible ? num(lista.subtotal.cantidad) : "—"}`,
      ...(montosDeLaLista.length ? [`Montos: ${montosDeLaLista.join(", ")}`] : []),
      `Periodo: ${vista.periodo.a.desde} a ${vista.periodo.a.hasta} (Bogotá)`,
      `Página ${num(entrada.pagina)}: ${num(lista.filas.length)} filas. ${haySiguiente ? `Hay otra página; pide pagina ${entrada.pagina + 1}.` : "No hay otra página."}`,
    ].join("\n");
    const dinero = lista.dinero;
    const cifraUsd = (valor: number) => ({ valor, unidad: "dinero" as const, moneda: "USD" as const });
    const linea = (item: { etiqueta: string; cantidad: number; caja: Array<{ moneda: string; total: number }> }) => ({
      nombre: item.etiqueta,
      cantidad: item.cantidad,
      entro_a_caja: item.caja,
    });
    return {
      texto,
      estructurado: {
        programa: { nombre: programa.nombre, slug: programa.slug },
        metrica: entrada.metrica,
        periodo: { desde: vista.periodo.a.desde, hasta: vista.periodo.a.hasta },
        filtros_aplicados: [
          ...(entrada.nombre_del_sku ? [{ campo: "nombre_del_sku" as const, id: entrada.nombre_del_sku, nombre: entrada.nombre_del_sku, origen: "pedido" as const }] : []),
          ...(entrada.sku ? [{ campo: "sku" as const, id: entrada.sku, nombre: entrada.sku, origen: "pedido" as const }] : []),
        ],
        resumen: {
          disponible: lista.disponible,
          total: lista.subtotal.cantidad,
          entro_a_caja: lista.subtotal.caja,
          vendido: dinero ? cifraUsd(dinero.vendido) : null,
          recaudado: dinero ? cifraUsd(dinero.recaudado) : null,
          por_cobrar: dinero ? cifraUsd(dinero.porCobrar) : null,
        },
        desgloses: {
          por_responsable: desgloses.porCloser.map(linea),
          por_etapa: desgloses.porEtapa.map(linea),
          por_antiguedad: desgloses.porAntiguedad.map(linea),
        },
        paginacion: { pagina: entrada.pagina, filas_en_esta_pagina: filas.length, hay_siguiente: haySiguiente },
        filas,
        siguientes_pasos: siguientesPasosDeMetrica(contexto, entrada, {
          desde: vista.periodo.a.desde,
          hasta: vista.periodo.a.hasta,
          haySiguiente,
          enlace: enlaceDeSeccionHub(programa.slug, "comercial"),
        }),
        enlace: enlaceDeSeccionHub(programa.slug, "comercial"),
      },
    };
  },
};
