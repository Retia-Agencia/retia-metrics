import { z } from "zod";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota, monto, num, pct } from "@/lib/format";
import { parsearPeriodoUrl } from "@/lib/periodo";
import {
  capacidadParaMetrica,
  desglosesDelResumen,
  proyectarListaSegunRol,
  TAMANO_PAGINA,
  type Metrica,
} from "@/lib/queries/metricas-con-filas";
import { armarVistaDelDashboard, resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { nombreDeEtapa, proyectarDashboardSegunRol, vistaDeLista } from "@/lib/queries/vista-metrica";
import type { Herramienta } from "./tipos";

const METRICAS = [
  "caja", "agendas", "canceladas", "citas_debidas", "citas_sin_marcar", "shows", "no_shows",
  "shows_sin_grain", "cierres", "cortesias", "leads", "deals_creados", "deals_que_agendaron",
  "deals_desde_completo", "deals_desde_parcial", "completos_que_agendaron", "parciales_que_agendaron",
  "agendas_creadas", "registros", "agendas_futuras", "contratado", "sin_resultado", "atendidos_sin_valor",
  "atendidos_sin_grain", "grupo_citas", "grupo_shows", "grupo_vendidos", "grupo_sin_show",
  "grupo_pendientes", "embudo_comercial_creados", "embudo_comercial_agendaron", "embudo_comercial_shows",
  "embudo_comercial_compraron", "etapa_entraron", "etapa_paso", "etapa_siguen", "etapa_perdidos",
  "etapa_otros", "etapa_tiempo", "etapa_abiertos", "etapa_sin_dueno", "no_agendaron", "pauta_meta", "escalera",
] as const satisfies readonly Metrica[];

const PERIODOS = ["hoy", "ayer", "manana", "esta_semana", "semana_pasada", "este_mes", "mes_pasado", "desde_el_inicio", "custom"] as const;
const fechaBogota = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha AAAA-MM-DD de Bogotá.");
const periodo = {
  periodo: z.enum(PERIODOS),
  desde: fechaBogota.optional(),
  hasta: fechaBogota.optional(),
};

function busquedaDePeriodo(entrada: { periodo: (typeof PERIODOS)[number]; desde?: string; hasta?: string }) {
  if (entrada.periodo === "custom" && (!entrada.desde || !entrada.hasta)) {
    throw new ErrorDeApp("Un periodo custom necesita desde y hasta.", 400);
  }
  if (entrada.periodo !== "custom" && (entrada.desde || entrada.hasta)) {
    throw new ErrorDeApp("Desde y hasta solo se usan con el periodo custom.", 400);
  }
  return {
    periodo: entrada.periodo,
    ...(entrada.desde ? { a_desde: entrada.desde } : {}),
    ...(entrada.hasta ? { a_hasta: entrada.hasta } : {}),
    comparar: "no",
  };
}

async function programaVisible(contexto: Parameters<Herramienta["ejecutar"]>[0], slug: string) {
  const programa = await programaVisiblePorSlug(contexto.session.user.id, contexto.rol, slug, contexto.db);
  if (!programa) throw new ErrorDeApp("No existe ese programa", 404);
  return programa;
}

function tasaLegible(nombre: string, valor: number | null, cobertura: number | null, parcial: boolean): string {
  return `${nombre}: ${valor === null ? "—" : pct(valor)} · cobertura ${cobertura === null ? "—" : pct(cobertura)}${parcial ? " (parcial)" : ""}`;
}

const entradaResumen = z.object({ programa: z.string().min(1), ...periodo }).strict();

export const resumenDelHubMcp: Herramienta<typeof entradaResumen> = {
  nombre: "resumen_del_hub",
  descripcion:
    "Resume las cifras del Hub de un programa para el periodo pedido: ventas, caja, agendas, shows y tasas. " +
    "Las fechas son días de Bogotá (AAAA-MM-DD), cada monto conserva su moneda y toda tasa informa su cobertura; " +
    "— significa que no se puede calcular. No mezcla programas ni devuelve filas individuales.",
  entrada: entradaResumen,
  puede: (contexto) => veTableroDelPrograma(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const programa = await programaVisible(contexto, entrada.programa);
    const hoy = hoyEnBogota();
    const periodoPedido = parsearPeriodoUrl(busquedaDePeriodo(entrada));
    const entradaDeVista = { programId: programa.id, hoy, periodo: periodoPedido, preset: entrada.periodo };
    const contextoDeVista = await resolverContextoDeVista(entradaDeVista, contexto.db);
    const sinProyectar = await armarVistaDelDashboard(entradaDeVista, contexto.db, contextoDeVista);
    const vista = proyectarDashboardSegunRol(sinProyectar, contexto.rol);
    const grupo = vista.embudo.grupo;
    const caja = vista.caja.map((valor) => monto(valor.total, valor.moneda));
    const lineas = [
      `Programa: ${programa.nombre}`,
      `Periodo: ${vista.periodo.a.desde} a ${vista.periodo.a.hasta} (Bogotá)`,
      `Ventas cerradas: ${num(vista.embudo.cierres)}`,
      `Vendido: ${monto(vista.dinero.vendido, "USD")}`,
      `Caja: ${caja.length ? caja.join(", ") : monto(0, "USD")}`,
      `Agendas: ${num(vista.embudo.agendas)} · shows: ${num(vista.embudo.llamadasConShow)}`,
      tasaLegible("Show", vista.embudo.pctShow, grupo.cobertura, grupo.parcial),
      tasaLegible("Cierre", vista.embudo.pctCierre, grupo.cobertura, grupo.parcial),
      tasaLegible("Agenda a venta", vista.embudo.agendaAVenta, grupo.cobertura, grupo.parcial),
    ];
    return { texto: lineas.join("\n"), estructurado: { programa: { nombre: programa.nombre, slug: programa.slug }, vista } };
  },
};

const entradaMetrica = z.object({
  programa: z.string().min(1),
  metrica: z.enum(METRICAS),
  ...periodo,
  closer: z.string().regex(/^[a-f0-9]{64}$/, "El closer debe ser su código opaco de 64 caracteres.").optional(),
  etapa: z.string().max(100).optional(),
  antiguedad: z.string().max(100).optional(),
  pagina: z.number().int().min(1).max(1_000_000).default(1),
}).strict();

export const consultarMetricaMcp: Herramienta<typeof entradaMetrica> = {
  nombre: "consultar_metrica",
  descripcion:
    "Consulta el número de una métrica del Hub, sus desgloses por closer, etapa y antigüedad, y hasta 50 filas de la página pedida. " +
    "Programa y periodo son obligatorios; las fechas son días de Bogotá. El filtro closer acepta solo el código opaco que devuelve el CRM. " +
    "Los montos siempre incluyen moneda, — significa que no se puede calcular y la respuesta indica si existe una página siguiente.",
  entrada: entradaMetrica,
  puede: (contexto) => veTableroDelPrograma(contexto.rol) || veEquipoComercial(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const programa = await programaVisible(contexto, entrada.programa);
    const capacidad = capacidadParaMetrica({ metrica: entrada.metrica, tieneOrigen: false });
    if (!capacidad(contexto.rol)) throw new ErrorDeApp("No existe ese programa", 404);
    const busqueda = busquedaDePeriodo(entrada);
    const vista = await vistaDeLista({
      programId: programa.id,
      metrica: entrada.metrica,
      busqueda,
      hoy: hoyEnBogota(),
      codigoCloser: entrada.closer,
      etapa: entrada.etapa,
      antiguedad: entrada.antiguedad,
      pagina: entrada.pagina,
    }, contexto.db);
    if (!vista) throw new ErrorDeApp("No existe ese programa", 404);
    const esListaDePauta = entrada.metrica === "pauta_meta";
    const esListaDeOrigen = entrada.metrica === "registros" || entrada.metrica === "agendas_creadas";
    const lista = proyectarListaSegunRol(vista.lista, { rol: contexto.rol, metrica: entrada.metrica, esListaDePauta, esListaDeOrigen });
    const desgloses = desglosesDelResumen(lista.grupos, nombreDeEtapa);
    const haySiguiente = entrada.pagina * TAMANO_PAGINA < lista.subtotal.cantidad;
    const caja = lista.subtotal.caja.map((valor) => monto(valor.total, valor.moneda));
    const base = process.env.AUTH_URL ?? "http://localhost:3000";
    const filas = lista.filas.map((fila) => {
      const ruta = fila.dealId
        ? `/p/${encodeURIComponent(programa.slug)}/deals/${fila.dealId}`
        : fila.persona
          ? `/p/${encodeURIComponent(programa.slug)}/leads/${fila.persona.leadId}`
          : null;
      return { ...fila, enlace: ruta ? new URL(ruta, base).toString() : null };
    });
    const texto = [
      `${entrada.metrica}: ${lista.disponible ? num(lista.subtotal.cantidad) : "—"}`,
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
