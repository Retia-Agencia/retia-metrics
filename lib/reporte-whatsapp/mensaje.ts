import { horaEnBogota, instanteDeBogota, num } from "@/lib/format";
import { rutaDePrograma } from "@/lib/nav";
import { DEFINICION_METRICAS_OBJETIVO } from "@/lib/objetivos/metricas";
import { NOTA_SIN_ERRORES } from "@/lib/semaforo/semaforo";
import type { RespuestaSemaforo } from "./contrato";

const EMOJI = {
  exito: "🟢",
  alerta: "🟡",
  peligro: "🔴",
  sin_dato: "⚪",
} as const;

const MOTIVO = {
  sin_cohorte: "No hay cohorte activa",
  sin_umbral: "Falta cargar la meta en el CRM",
  sin_pauta: "No hay gasto de pauta hoy",
  sin_agendas_meta: "Meta no reporta agendas de este programa",
} as const;

type Bloque = RespuestaSemaforo["envios"][number]["bloques"][number];
type Sincronizacion = RespuestaSemaforo["sincronizacion"];
type Metrica = Bloque["metricas"][number];

function dinero(valor: number | null): string {
  return valor === null ? "sin dato" : `$${num(Math.round(valor))} COP`;
}

function frenteALaMeta(porcentajeDelUmbral: number | null): string {
  if (porcentajeDelUmbral === null) return "";
  const diferencia = Math.round(porcentajeDelUmbral) - 100;
  if (diferencia > 0) return ` · ${num(diferencia)}% más caro que la meta`;
  if (diferencia < 0) return ` · ${num(-diferencia)}% más barato que la meta`;
  return " · igual a la meta";
}

function lineasMetrica(metrica: Metrica, tipo: Bloque["tipo"]): string[] {
  const costo = metrica.costo === null && metrica.agendasMeta === 0 && metrica.gasto > 0
    ? "sin agendas"
    : dinero(metrica.costo);
  const lineas = [
    `${EMOJI[metrica.color]} ${DEFINICION_METRICAS_OBJETIVO[metrica.metrica].nombre}: ${costo}${frenteALaMeta(metrica.porcentajeDelUmbral)}`,
  ];

  if (metrica.umbral) {
    lineas.push(
      `Meta ${dinero(metrica.umbral.meta)} · aceptable ${dinero(metrica.umbral.aceptable)}`,
    );
  }
  lineas.push(
    `Gasto ${dinero(metrica.gasto)} · agendas Meta ${metrica.agendasMeta === null ? "—" : num(metrica.agendasMeta)} · CRM ${num(metrica.agendasCrm)}`,
  );
  const etiqueta = tipo === "cierre" ? "Día anterior" : "Ayer a esta hora";
  lineas.push(metrica.comparacion
    ? `${etiqueta}: ${dinero(metrica.comparacion.costo)} · agendas Meta ${metrica.comparacion.agendasMeta === null ? "—" : num(metrica.comparacion.agendasMeta)} · CRM ${num(metrica.comparacion.agendasCrm)}`
    : `${etiqueta}: sin foto`);
  if (metrica.diasSeguidosEnRojo > 0) {
    const dias = Number(metrica.diasSeguidosEnRojo);
    lineas.push(`🔴 ${num(dias)} ${dias === 1 ? "día seguido" : "días seguidos"} en rojo`);
  }
  if (metrica.motivo) lineas.push(MOTIVO[metrica.motivo]);
  for (const nota of metrica.notas.filter((nota) => nota.tipo === "problema")) {
    lineas.push(`⚠️ ${nota.texto}`);
  }
  if (tipo === "cierre" && metrica.trayectoria.length > 0) {
    const puntos = metrica.trayectoria.map(
      (punto) => `${punto.hora} ${dinero(punto.gasto)} · ${punto.agendasMeta === null ? "—" : num(punto.agendasMeta)} ag Meta`,
    );
    lineas.push(`Trayectoria: ${puntos.join(" | ")}`);
  }
  return lineas;
}

function conteoDeColores(bloques: Bloque[]): string {
  const conteos = { peligro: 0, alerta: 0, exito: 0, sin_dato: 0 };
  for (const bloque of bloques) {
    const color = bloque.metricas[0]?.color;
    if (color) conteos[color] += 1;
  }
  return (["peligro", "alerta", "exito", "sin_dato"] as const)
    .filter((color) => conteos[color] > 0)
    .map((color) => `${conteos[color]}${EMOJI[color]}`)
    .join(" · ");
}

function fechaDeCierre(dia: string): string {
  const instante = instanteDeBogota(dia, "12:00");
  if (!instante) return dia;
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value.replace(".", "") ?? "";
  return `${valor("weekday")} ${valor("day")}-${valor("month")}`;
}

export function enlaceAlHub(origen: string, slug: string): string {
  return `${origen}${rutaDePrograma(slug, "hub")}?seccion=pauta`;
}

export function avisoDeErrorDeSincronizacion(
  sincronizacion: Sincronizacion,
): string | null {
  if (sincronizacion?.estado !== "error") return null;
  const hora = sincronizacion.ultimaFoto ? horaEnBogota(sincronizacion.ultimaFoto) : null;
  return `⚠️ No se pudo leer Meta; cifras de la última foto${hora ? ` (${hora})` : ""}`;
}

export function armarMensajeDeLaHora(
  bloques: Bloque[],
  hora: string,
  sincronizacion: Sincronizacion,
  origen: string,
): string {
  const todosSonCierre = bloques.every((bloque) => bloque.tipo === "cierre");
  const tiposMixtos = new Set(bloques.map((bloque) => bloque.tipo)).size > 1;
  const conteo = conteoDeColores(bloques);
  const titulo = todosSonCierre
    ? `🌙 Cierre del ${fechaDeCierre(bloques[0]?.metricas[0]?.dia ?? "")}`
    : `🚦 Semáforo de pauta · ${hora}${conteo ? ` · ${conteo}` : ""}`;
  const lineas = [titulo, ""];

  const bloquesFormateados = bloques.map((bloque) => {
    const cierre = tiposMixtos && bloque.tipo === "cierre" ? " (cierre)" : "";
    const lineasBloque = [`*${bloque.programa}*${cierre}`];
    if (bloque.error) lineasBloque.push(`⚠️ ${bloque.error}`);
    else {
      for (const metrica of bloque.metricas) {
        lineasBloque.push(...lineasMetrica(metrica, bloque.tipo));
      }
    }
    return lineasBloque.join("\n");
  });
  lineas.push(bloquesFormateados.join("\n━━━━━━━━━━\n"), "");

  const avisoSincronizacion = avisoDeErrorDeSincronizacion(sincronizacion);
  if (avisoSincronizacion) lineas.push(avisoSincronizacion);

  const notasInformativas = new Set<string>();
  let tieneProblemas = bloques.some((bloque) => bloque.error !== null);
  for (const bloque of bloques) {
    if (bloque.error) continue;
    for (const metrica of bloque.metricas) {
      for (const nota of metrica.notas) {
        if (nota.tipo === "problema") tieneProblemas = true;
        else if (nota.texto !== NOTA_SIN_ERRORES) notasInformativas.add(nota.texto);
      }
    }
  }
  for (const nota of notasInformativas) lineas.push(`ℹ️ ${nota}`);
  if (!tieneProblemas) lineas.push("✅ Sin errores en esta corrida");
  lineas.push(`CRM: ${origen}`);
  lineas.push("ℹ️ Costo = gasto ÷ agendas Meta (pixel). CRM = citas con UTM de pauta.");
  return lineas.join("\n");
}
