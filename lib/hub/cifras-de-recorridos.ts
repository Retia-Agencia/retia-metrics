/** Comercial: escalera, pérdidas, caminos, semanas y auditoría. Solo presenta datos ya consultados (419 E-2). */
import { num } from "@/lib/format";
import { comparacionCon, enCurso, filtrosDelHub, listaDeDetalle, periodoEnPalabras, periodoDelHub, type ContextoDelHub } from "@/lib/hub/contexto-de-cifras";
import { armarCifra, type EntradaDeCifra, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { PasoDelEmbudoComercial } from "@/lib/queries/embudo-comercial";
import type { AbiertosPorEtapaYOwner, SinDuenoPorAntiguedad, ResultadoEmbudoEtapas } from "@/lib/queries/embudo-etapas";
import type { CeldaDeEscalera, FilaDeEscalera, VistaDeEscalera } from "@/lib/queries/vista-escalera";
import type { DetalleDeCifra, DetallesDeOperacion } from "@/lib/queries/vista-metrica";

/** Claves de presentación pendientes de las fichas de E-1; el texto siempre llega del llamador. */
export type ExplicacionesDeRecorridos = Readonly<Record<string, ExplicacionDeConcepto>>;
interface ContextoDeRecorridos { contexto: ContextoDelHub; explicaciones: ExplicacionesDeRecorridos; referencia?: string }
function constructor(e: ContextoDeRecorridos) {
  return (concepto: string, valor: number | null, opciones: Partial<Omit<EntradaDeCifra, "concepto" | "valor" | "explicacion">> = {}) => {
    const explicacion = e.explicaciones[concepto];
    if (!explicacion) throw new Error(`Falta la explicación de ${concepto}`);
    return armarCifra({ concepto, explicacion, valor, filtros: filtrosDelHub(e.contexto), periodo: periodoEnPalabras(e.contexto), enCurso: enCurso(e.contexto), ...opciones });
  };
}

export function cifrasDeEscalera(e: ContextoDeRecorridos & { vista: VistaDeEscalera }) {
  const cifra = constructor(e);
  const fila = (f: FilaDeEscalera, dimension?: "Closer" | "Calidad") => {
    const filtros = dimension ? [...filtrosDelHub({ ...e.contexto, closer: dimension === "Closer" ? null : e.contexto.closer }), [dimension, f.etiqueta] as const] : filtrosDelHub(e.contexto);
    const celda = (clave: string, c: CeldaDeEscalera) => ({
      cantidad: cifra(clave, c.deals, { filtros, lista: listaDeDetalle(c.detalle, undefined, { nombre: "deals", articulo: "los" }), comparacion: e.vista.hayComparacion ? comparacionCon(e.referencia, c.anterior) : undefined }),
      // La consulta expresa el porcentaje entre 0 y 100; la Cifra lo recibe como fracción.
      porcentaje: cifra("porcentaje_de_escalera", c.porcentaje.valor === null ? null : c.porcentaje.valor / 100, { filtros, motivo: "No hay deals en este conjunto" }),
      diasMedianos: cifra("dias_medianos_de_escalera", c.diasMedianos, { filtros, motivo: "No hay tiempo de cita a pago medido para este escalón" }),
    });
    return {
      clave: f.clave, etiqueta: f.etiqueta,
      celdas: Object.fromEntries(Object.entries(f.celdas).filter(([k]) => !(e.vista.sinCorte && k === "pago_rapido")).map(([k, c]) => [k, celda(k, c)])),
      grupos: Object.fromEntries(Object.entries(f.grupos).map(([k, c]) => [k, celda(k, c).cantidad])),
      citaSinResultado: cifra("cita_sin_resultado_de_escalera", f.citaSinResultado.deals, { filtros, lista: listaDeDetalle(f.citaSinResultado.detalle, undefined, { nombre: "deals", articulo: "los" }) }),
    };
  };
  return { principal: fila(e.vista.principal), porCloser: e.vista.porCloser.map((f) => fila(f, "Closer")), porCalidad: e.vista.porCalidad.map((f) => fila(f, "Calidad")) };
}

export function cifrasDelEmbudoComercial(e: ContextoDeRecorridos & {
  pasos: ReadonlyArray<PasoDelEmbudoComercial & { detalle?: DetalleDeCifra; detallePerdidos?: DetalleDeCifra }>; origen: "todos" | "completo" | "parcial" | "manual";
}) {
  const cifra = constructor(e);
  const origen = { todos: "Todos", completo: "Formulario completo", parcial: "Formulario parcial", manual: "Alta manual" }[e.origen];
  const filtros = [...filtrosDelHub(e.contexto), ["Origen del deal", origen] as const];
  return e.pasos.map((p, indice) => ({
    paso: p.paso,
    cantidad: cifra(`embudo_comercial_${p.paso}`, p.cantidad, { filtros, lista: listaDeDetalle(p.detalle, undefined, { nombre: "deals", articulo: "los" }) }),
    porcentaje: cifra("conversion_del_paso", p.pctDelPaso, { filtros, motivo: "El paso anterior no tiene deals" }),
    perdidos: indice === 0 ? null : cifra("perdidos_del_paso", p.perdidos, { filtros }),
  }));
}

export function cifrasDeCaminos(e: ContextoDeRecorridos & { embudo: ResultadoEmbudoEtapas }) {
  const contexto = { ...e.contexto, closer: null };
  const cifra = constructor({ ...e, contexto });
  const tiempos = new Map(e.embudo.tiempoEnEtapa.map((t) => [t.etapa, t.medianaDiasHabiles]));
  return e.embudo.conversion.porCamino.map((c) => ({
    camino: c.camino,
    pasos: c.pasos.map((p) => {
      const filtros = [...filtrosDelHub(contexto), ["Camino", c.camino === "setter" ? "Del setter" : "De la llamada"] as const];
      return {
        etapa: p.etapa,
        pasaron: cifra("pasaron", p.pasaron, { filtros }),
        siguen: cifra("siguen_en_etapa", p.siguenAqui, { filtros }),
        perdidos: cifra("perdidos_en_etapa", p.perdidosAqui, { filtros }),
        // Es el tiempo de la etapa del programa, igual que en la pantalla actual; no se recalcula por camino.
        diasMedianos: cifra("dias_medianos_en_etapa", tiempos.get(p.etapa === "ganado" ? "ganado_parcial" : p.etapa) ?? null, { motivo: "No hay tiempo medido en esta etapa" }),
      };
    }),
  }));
}

export function cifrasDeCitasPorSemana(e: ContextoDeRecorridos & Pick<DetallesDeOperacion, "semanas" | "proximas">) {
  const cifra = constructor(e);
  const filas = new Map<string, { desde: string; hasta: string; shows?: DetalleDeCifra; noShows?: DetalleDeCifra; pendientes?: DetalleDeCifra; futuras?: DetalleDeCifra }>();
  for (const s of e.semanas) filas.set(s.semana.desde, { ...s.semana, shows: s.shows, noShows: s.noShows, pendientes: s.pendientes });
  for (const p of e.proximas) filas.set(p.semana.desde, { ...(filas.get(p.semana.desde) ?? p.semana), futuras: p.futuras });
  return [...filas.values()].filter((s) => [s.shows, s.noShows, s.pendientes, s.futuras].some((d) => (d?.resumen.subtotal.cantidad ?? 0) > 0)).map((s) => {
    const contexto = { ...e.contexto, closer: null, rango: { desde: s.desde, hasta: s.hasta } };
    const celda = (concepto: string, detalle?: DetalleDeCifra) => cifra(concepto, detalle?.resumen.subtotal.cantidad ?? 0, {
      filtros: filtrosDelHub(contexto), periodo: periodoEnPalabras(contexto), enCurso: enCurso(contexto),
      lista: listaDeDetalle(detalle, undefined, { nombre: "citas", articulo: "las" }),
    });
    return { desde: s.desde, hasta: s.hasta, semana: periodoDelHub(contexto.rango, contexto.hoy),
      realizadas: celda("shows", s.shows), noAsistio: celda("no_asistio", s.noShows), sinMarcar: celda("citas_sin_marcar", s.pendientes), futuras: celda("citas_futuras", s.futuras) };
  });
}

export function cifrasDeAuditoria(e: ContextoDeRecorridos & { embudo: Omit<ResultadoEmbudoEtapas, "abiertos" | "sinDuenoPorAntiguedad"> & {
  abiertos: Array<AbiertosPorEtapaYOwner & { detalle?: DetalleDeCifra }>;
  sinDuenoPorAntiguedad: Array<SinDuenoPorAntiguedad & { detalle?: DetalleDeCifra }>;
}; ventasSinLlamada?: CeldaDeEscalera }) {
  const cifra = constructor(e);
  // Los abiertos y sin dueño son una foto de hoy, acotada por cohorte; no siguen periodo ni closer.
  const filtros = [["Programa", e.contexto.programa], ["Cohorte", e.contexto.cohorte ?? "Todas"], ["Día", "Hoy"]] as const;
  return {
    abiertos: e.embudo.abiertos.map((f) => ({ etapa: f.etapa, owner: f.ownerNombre,
      cifra: cifra("deals_abiertos", f.deals, { filtros: [...filtros, ["Responsable", f.ownerNombre ?? "Sin dueño"]], periodo: "hoy", enCurso: false, lista: listaDeDetalle(f.detalle, undefined, { nombre: "deals", articulo: "los" }) }) })),
    sinDueno: e.embudo.sinDuenoPorAntiguedad.map((f) => ({ antiguedad: f.bucket,
      cifra: cifra("deals_sin_dueno", f.deals, { filtros: [...filtros, ["Antigüedad en días", f.bucket]], periodo: "hoy", enCurso: false, lista: listaDeDetalle(f.detalle, undefined, { nombre: "deals", articulo: "los" }) }) })),
    motivos: e.embudo.motivosDePerdida.map((f) => ({ motivo: f.motivo,
      deals: cifra("deals_perdidos", f.deals, { filtros: filtrosDelHub({ ...e.contexto, closer: null }) }), ticket: cifra("ticket_perdido", f.ticketPerdidoUsd, { filtros: filtrosDelHub({ ...e.contexto, closer: null }), parcial: f.dealsSinTicket > 0 ? `${num(f.dealsSinTicket)} deals no tienen ticket estimado.` : undefined }) })),
    ventasSinLlamada: e.ventasSinLlamada ? cifra("ventas_sin_llamada", e.ventasSinLlamada.deals, { lista: listaDeDetalle(e.ventasSinLlamada.detalle, undefined, { nombre: "ventas", articulo: "las" }) }) : null,
  };
}
