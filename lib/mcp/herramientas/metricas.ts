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
import { armarVistaDelDashboard, resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { nombreDeEtapa, proyectarDashboardSegunRol, vistaDeLista } from "@/lib/queries/vista-metrica";
import type { Herramienta } from "./tipos";
import { programaVisible } from "./programa";
import { enlaceDeDeal, enlaceDeLead, enlaceDeSeccionHub } from "@/lib/mcp/enlaces";
import { busquedaDePeriodoMcp, camposDePeriodoMcp, presetDePeriodoMcp } from "./periodo";
import { nombreCorto, nombreLargo, TITULOS_DE_LISTA } from "@/lib/vocabulario-metricas";
import { aSalidaDeResumen, salidaDeResumen } from "@/lib/mcp/salidas/resumen";
import { salidaDeConsultaDeMetrica } from "@/lib/mcp/salidas/metrica";
import { textoDeRazon, type RazonConCobertura } from "@/lib/cobertura";

function tasaLegible(nombre: string, razon: RazonConCobertura, cobertura: number | null, parcial: boolean): string {
  return `${nombre}: ${textoDeRazon(razon, pct)} · cobertura ${cobertura === null ? "—" : pct(cobertura)}${parcial ? " (parcial)" : ""}`;
}

const entradaResumen = z.object({ programa: z.string().min(1).max(100), ...camposDePeriodoMcp }).strict();

export const resumenDelHubMcp: Herramienta<typeof entradaResumen> = {
  nombre: "resumen_del_hub",
  titulo: "Resumen del Hub",
  descripcion:
    `Úsala cuando necesites las cifras principales del Hub de un programa para un periodo. Devuelve ${nombreCorto("ventas").toLocaleLowerCase()}, ${nombreCorto("vendido").toLocaleLowerCase()}, recaudado, por cobrar, dinero que entró a caja, ${nombreCorto("citas").toLocaleLowerCase()}, ${nombreCorto("shows").toLocaleLowerCase()} y tasas con cobertura. ` +
    "Las fechas son días de Bogotá (AAAA-MM-DD), cada monto conserva su moneda y toda tasa informa su cobertura; " +
    "— significa que no se puede calcular. No mezcla programas ni devuelve filas individuales.",
  entrada: entradaResumen,
  salida: salidaDeResumen,
  puede: (contexto) => veTableroDelPrograma(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const programa = await programaVisible(contexto, entrada.programa);
    const hoy = hoyEnBogota();
    const periodoPedido = parsearPeriodoUrl(busquedaDePeriodoMcp(entrada));
    const entradaDeVista = { programId: programa.id, hoy, periodo: periodoPedido, preset: presetDePeriodoMcp(entrada) };
    const contextoDeVista = await resolverContextoDeVista(entradaDeVista, contexto.db);
    const sinProyectar = await armarVistaDelDashboard(entradaDeVista, contexto.db, contextoDeVista);
    const vista = proyectarDashboardSegunRol(sinProyectar, contexto.rol);
    const grupo = vista.embudo.grupo;
    const caja = vista.caja.map((valor) => monto(valor.total, valor.moneda));
    const enlace = enlaceDeSeccionHub(programa.slug, "comercial");
    const lineas = [
      `Programa: ${programa.nombre}`,
      `Periodo: ${vista.periodo.a.desde} a ${vista.periodo.a.hasta} (Bogotá)`,
      `${nombreLargo("ventas")}: ${num(vista.embudo.cierres)}`,
      `${nombreCorto("vendido")}: ${monto(vista.dinero.vendido, "USD")}`,
      `${nombreCorto("entro_a_caja")}: ${caja.length ? caja.join(", ") : monto(0, "USD")}`,
      `${nombreCorto("citas")}: ${num(vista.embudo.agendas)} · ${nombreCorto("shows")}: ${num(vista.embudo.llamadasConShow)}`,
      tasaLegible(nombreCorto("asistencia"), vista.embudo.razonShow, grupo.cobertura, grupo.parcial),
      tasaLegible(nombreCorto("cierre_de_ventas"), vista.embudo.razonCierre, grupo.cobertura, grupo.parcial),
      `${nombreCorto("cita_a_venta")}: ${vista.embudo.agendaAVenta === null ? "—" : pct(vista.embudo.agendaAVenta)} · cobertura ${grupo.cobertura === null ? "—" : pct(grupo.cobertura)}${grupo.parcial ? " (parcial)" : ""}`,
      enlace,
    ];
    return { texto: lineas.join("\n"), estructurado: aSalidaDeResumen(vista, { nombre: programa.nombre, slug: programa.slug }, enlace) };
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
      origenDeal: entrada.origen,
      etapa: entrada.etapa,
      antiguedad: entrada.antiguedad,
      source,
      medium,
      campaign,
      resultado: entrada.resultado,
      categoria: entrada.categoria,
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
    const caja = lista.subtotal.caja.map((valor) => monto(valor.total, valor.moneda));
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
      ...(caja.length ? [`Montos: ${caja.join(", ")}`] : []),
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
        enlace: enlaceDeSeccionHub(programa.slug, "comercial"),
      },
    };
  },
};
