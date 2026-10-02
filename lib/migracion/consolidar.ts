import type { EtapaDeal } from "@/lib/deals/etapas";
import { normalizarTexto } from "./celdas";
import type { DealTemplate, Extraccion, LlamadaTemplate, RarezaTemplate } from "./template";

/**
 * Los cruces ENTRE pestañas de un programa, antes de importar (ADR 0059). Puro.
 *
 * Cada extractor mira una sola pestaña; aqui se decide lo que solo se ve juntandolas:
 *
 * - **Un estudiante que tambien esta en el Setteo es UNA oportunidad, no dos.** Su fila de
 *   Setteo no crea deal (`sinDeal: es_estudiante`) y sus `Registro` pasan como notas al deal
 *   del estudiante: la historia del contacto no se pierde y la venta no se cuenta dos veces.
 * - **Un correo en dos pestañas de Estudiantes** queda con sus dos deals y una rareza por cada
 *   uno: cual es la cohorte buena lo decide una persona, no este codigo. Como un Completo no
 *   ocupa el cupo, la base los deja entrar a los dos. **Salvo que la persona ya lo decidio**
 *   marcando `movidoDesde` en el template (los "cohorte pasada" del 080): entonces el deal de
 *   la cohorte de origen no se crea y el que queda lleva la nota del traslado.
 * - **La etapa de un deal del Setteo la decide su ultima llamada** (decisiones del 080): Show
 *   No → Agendado con Re-agenda pendiente; Show Si → Atendido. Nunca Cierre Perdido: una categoria de
 *   perdida queda como rareza para que la cierre un closer (Mani, 28-sep). A un deal de
 *   Estudiantes su etapa se la da la pestaña de Estudiantes y ninguna llamada la cambia.
 *
 * Tambien arma el indice correo → deal que usa el importador para colgar cada llamada: una
 * llamada se cuelga del deal migrado de SU correo (ADR 0027: nada por cercania), y solo si
 * ese correo tiene UN deal; con dos, la llamada entra suelta y queda como rareza.
 */
export interface Consolidado extends Extraccion {
  /** correo → huella del deal del que cuelgan sus llamadas. */
  dealDeCorreo: Map<string, string>;
}

/**
 * Las categorias del `Registro de llamadas` que dicen que la oportunidad se perdio. Son texto de
 * la hoja, leido una sola vez en la migracion: marcan una rareza, no deciden una etapa.
 */
const CATEGORIAS_DE_PERDIDA = new Set(["rechazo directo", "fit/producto", "financiero"]);

/** Las etapas que puede tener un deal del Setteo, las unicas que una llamada puede afinar. */
const ETAPAS_DEL_SETTEO: readonly EtapaDeal[] = ["registrado", "contactado"];

export function consolidar(e: Extraccion): Consolidado {
  const rarezas = [...e.rarezas];
  const sinDeal = [...e.sinDeal];

  // Los "cohorte pasada" marcados a mano: el deal de la cohorte de la que vinieron no se crea.
  const movidos = new Set(e.deals.filter((d) => d.movidoDesde).map((d) => `${d.correo}|${d.movidoDesde}`));
  const deOrigen = (d: DealTemplate) => d.cohorte != null && !d.movidoDesde && movidos.has(`${d.correo}|${d.cohorte}`);
  for (const d of e.deals) if (deOrigen(d)) sinDeal.push({ huella: d.huella, razon: "movido_de_cohorte" });
  const vigentes = e.deals.filter((d) => !deOrigen(d));

  const deEstudiantes = new Map<string, DealTemplate[]>();
  for (const d of vigentes) {
    if (d.cohorte == null) continue;
    deEstudiantes.set(d.correo, [...(deEstudiantes.get(d.correo) ?? []), d]);
  }

  for (const [, varios] of deEstudiantes) {
    if (varios.length < 2) continue;
    for (const d of varios) {
      rarezas.push({
        huella: d.huella,
        tipo: "en_dos_cohortes",
        detalle: `El correo está en ${varios.length} pestañas de Estudiantes (${varios.map((v) => v.cohorte).join(", ")}): revisar cuál es su cohorte.`,
      });
    }
  }

  // La fila de Setteo del estudiante no crea deal: sus notas van al deal de la venta (el de
  // la ultima pestaña donde aparece). Se copia, no se muta la extraccion que entro.
  const notasHeredadas = new Map<string, DealTemplate["notas"]>();
  for (const d of vigentes) {
    const estudiante = deEstudiantes.get(d.correo);
    if (d.cohorte != null || !estudiante) continue;
    const destino = estudiante[estudiante.length - 1].huella;
    notasHeredadas.set(destino, [...(notasHeredadas.get(destino) ?? []), ...d.notas]);
    sinDeal.push({ huella: d.huella, razon: "es_estudiante" });
  }
  let deals: DealTemplate[] = [];
  for (const d of vigentes) {
    if (d.cohorte == null && deEstudiantes.has(d.correo)) continue;
    const notas = [...(notasHeredadas.get(d.huella) ?? []), ...d.notas];
    if (d.movidoDesde) notas.push({ texto: `Movido desde la cohorte ${d.movidoDesde} (según la hoja).`, fecha: null });
    deals.push(notas.length === d.notas.length ? d : { ...d, notas });
  }

  // Solo si el correo tiene UN deal migrado: con dos (dos cohortes) no hay evidencia de a cual
  // pertenece cada llamada, y entra suelta (ADR 0027).
  const porCorreo = new Map<string, string[]>();
  for (const d of deals) porCorreo.set(d.correo, [...(porCorreo.get(d.correo) ?? []), d.huella]);
  const dealDeCorreo = new Map<string, string>();
  for (const [correo, huellas] of porCorreo) if (huellas.length === 1) dealDeCorreo.set(correo, huellas[0]);

  // La ultima llamada de cada deal del Setteo afina su etapa.
  const llamadasDe = new Map<string, LlamadaTemplate[]>();
  for (const l of e.llamadas) {
    const huella = l.correo ? dealDeCorreo.get(l.correo) : undefined;
    if (huella) llamadasDe.set(huella, [...(llamadasDe.get(huella) ?? []), l]);
  }
  const resueltos = new Set<string>();
  deals = deals.map((d) => {
    const ultima = ultimaLlamada(llamadasDe.get(d.huella) ?? []);
    if (d.cohorte != null || !ETAPAS_DEL_SETTEO.includes(d.etapa) || !ultima || ultima.resultado === "agendada") return d;
    resueltos.add(d.huella);
    const r = etapaPorLlamada(d.huella, ultima);
    if (r.rareza) rarezas.push(r.rareza);
    return { ...d, etapa: r.etapa, pendiente: r.pendiente ?? null, fechaEtapa: ultima.fecha ?? d.fechaEtapa };
  });

  return {
    ...e,
    deals,
    // Un `Agendado` del Setteo que ya resolvio su llamada deja de estar por decidir.
    rarezas: rarezas.filter((r) => !(r.tipo === "agendado_por_decidir" && resueltos.has(r.huella))),
    sinDeal,
    dealDeCorreo,
  };
}

/** La de fecha mas reciente; sin fecha nunca le gana a una fechada, y entre iguales, la fila mas baja. */
function ultimaLlamada(llamadas: readonly LlamadaTemplate[]): LlamadaTemplate | null {
  const fila = (l: LlamadaTemplate) => Number(l.huella.match(/:(\d+)$/)?.[1] ?? 0);
  let mejor: LlamadaTemplate | null = null;
  for (const l of llamadas) {
    if (!mejor) {
      mejor = l;
      continue;
    }
    const porFecha = l.fecha === mejor.fecha ? 0 : l.fecha == null ? -1 : mejor.fecha == null ? 1 : l.fecha.localeCompare(mejor.fecha);
    if (porFecha > 0 || (porFecha === 0 && fila(l) > fila(mejor))) mejor = l;
  }
  return mejor;
}

function etapaPorLlamada(huella: string, l: LlamadaTemplate): Pick<DealTemplate, "etapa" | "pendiente"> & { rareza?: RarezaTemplate } {
  const categoria = l.categoria ? normalizarTexto(l.categoria) : null;
  const perdida = categoria != null && CATEGORIAS_DE_PERDIDA.has(categoria);
  const marca = (detalle: string): RarezaTemplate => ({ huella, tipo: "perdida_por_decidir", detalle });

  if (l.resultado === "no_show") {
    if (categoria === "rechazo directo") {
      return { etapa: "agendado", pendiente: "reagenda", rareza: marca(`Su última llamada fue No show con categoría "${l.categoria}": entra Agendado con Re-agenda pendiente y un closer decide si es Cierre Perdido.`) };
    }
    return { etapa: "agendado", pendiente: "reagenda" };
  }
  if (l.resultado === "cerrada") {
    return {
      etapa: "atendido",
      rareza: { huella, tipo: "cerrada_sin_estudiante", detalle: "Su última llamada dice Cierre = Sí, pero el correo no está en ninguna pestaña de Estudiantes: entra en Atendido, sin venta." },
    };
  }
  if (perdida) {
    return { etapa: "atendido", rareza: marca(`Su última llamada fue Show sin cierre con categoría "${l.categoria}": entra en Atendido y un closer decide si es Cierre Perdido.`) };
  }
  return { etapa: "atendido" };
}
