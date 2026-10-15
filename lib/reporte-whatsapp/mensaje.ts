import { horaEnBogota, num } from "@/lib/format";
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
  sin_referencia: "Sin referencia para comparar",
} as const;

type Bloque = RespuestaSemaforo["envios"][number]["bloques"][number];
type Sincronizacion = RespuestaSemaforo["sincronizacion"];
type Metrica = Bloque["metricas"][number];

function dinero(valor: number | null): string {
  return valor === null ? "sin dato" : `$${num(Math.round(valor))} COP`;
}

function cantidadAgendas(valor: number): string {
  return `${num(valor)} ${valor === 1 ? "agenda" : "agendas"}`;
}

function lineasMetrica(metrica: Metrica, tipo: Bloque["tipo"]): string[] {
  const lineas = [
    `${EMOJI[metrica.color]} ${DEFINICION_METRICAS_OBJETIVO[metrica.metrica].nombre}: ${dinero(metrica.costo)}`,
  ];

  if (metrica.umbral) {
    lineas.push(
      `Meta ${dinero(metrica.umbral.meta)} · aceptable ${dinero(metrica.umbral.aceptable)}`,
    );
  }
  let gasto = `Gasto ${dinero(metrica.gasto)} · ${cantidadAgendas(metrica.agendas)}`;
  if (metrica.ayerALaMismaHora) {
    gasto += ` · ayer ${dinero(metrica.ayerALaMismaHora.costo)} (${num(metrica.ayerALaMismaHora.agendas)})`;
  }
  lineas.push(gasto);
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
      (punto) => `${punto.hora} ${dinero(punto.gasto)} · ${num(punto.agendas)} ag`,
    );
    lineas.push(`Trayectoria: ${puntos.join(" | ")}`);
  }
  return lineas;
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
  const titulo = todosSonCierre ? "Cierre del día" : "Semáforo de pauta";
  const lineas = [`🚦 ${titulo} · ${hora}`, ""];

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
  return lineas.join("\n");
}
