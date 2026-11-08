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

function tasaLegible(nombre: string, valor: number | null, cobertura: number | null, parcial: boolean): string {
  return `${nombre}: ${valor === null ? "—" : pct(valor)} · cobertura ${cobertura === null ? "—" : pct(cobertura)}${parcial ? " (parcial)" : ""}`;
}

const entradaResumen = z.object({ programa: z.string().min(1).max(100), ...camposDePeriodoMcp }).strict();

export const resumenDelHubMcp: Herramienta<typeof entradaResumen> = {
  nombre: "resumen_del_hub",
  descripcion:
    "Resume las cifras del Hub de un programa para el periodo pedido: ventas, dinero que entró a caja, citas, realizadas y tasas. " +
    "Las fechas son días de Bogotá (AAAA-MM-DD), cada monto conserva su moneda y toda tasa informa su cobertura; " +
    "— significa que no se puede calcular. No mezcla programas ni devuelve filas individuales.",
  entrada: entradaResumen,
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
      `Vendido: ${monto(vista.dinero.vendido, "USD")}`,
      `${nombreCorto("entro_a_caja")}: ${caja.length ? caja.join(", ") : monto(0, "USD")}`,
      `${nombreCorto("citas")}: ${num(vista.embudo.agendas)} · ${nombreCorto("shows")}: ${num(vista.embudo.llamadasConShow)}`,
      tasaLegible(nombreCorto("asistencia"), vista.embudo.pctShow, grupo.cobertura, grupo.parcial),
      tasaLegible(nombreCorto("cierre_de_ventas"), vista.embudo.pctCierre, grupo.cobertura, grupo.parcial),
      tasaLegible("Cita a venta", vista.embudo.agendaAVenta, grupo.cobertura, grupo.parcial),
      enlace,
    ];
    return { texto: lineas.join("\n"), estructurado: { programa: { nombre: programa.nombre, slug: programa.slug }, enlace, vista } };
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
  descripcion:
    "Consulta el número de una métrica del Hub, sus desgloses por closer, etapa y antigüedad, y hasta 50 filas de la página pedida. " +
    "Programa y periodo son obligatorios; las fechas son días de Bogotá. Admite los mismos filtros semánticos de las listas del Hub: origen " +
    "(fuente, medio, categoría, área, canal y campaña), escalera de conversión y jerarquía de pauta; cada filtro solo existe para las métricas donde tiene sentido. " +
    "El filtro closer acepta solo el código opaco que devuelve el CRM. " +
    "Los montos siempre incluyen moneda, — significa que no se puede calcular y la respuesta indica si existe una página siguiente.",
  entrada: entradaMetrica,
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
      return { ...fila, enlace };
    });
    const texto = [
      `${TITULOS_DE_LISTA[entrada.metrica]}: ${lista.disponible ? num(lista.subtotal.cantidad) : "—"}`,
      ...(caja.length ? [`Montos: ${caja.join(", ")}`] : []),
      `Periodo: ${vista.periodo.a.desde} a ${vista.periodo.a.hasta} (Bogotá)`,
      `Página ${num(entrada.pagina)}: ${num(lista.filas.length)} filas. ${haySiguiente ? `Hay otra página; pide pagina ${entrada.pagina + 1}.` : "No hay otra página."}`,
    ].join("\n");
    return {
      texto,
      estructurado: { programa: { nombre: programa.nombre, slug: programa.slug }, metrica: entrada.metrica, periodo: vista.periodo, resumen: { disponible: lista.disponible, subtotal: lista.subtotal }, desgloses, pagina: entrada.pagina, haySiguiente, filas },
    };
  },
};
