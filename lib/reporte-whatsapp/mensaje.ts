import { horaEnBogota, num } from "@/lib/format";
import { rutaDePrograma } from "@/lib/nav";
import { DEFINICION_METRICAS_OBJETIVO } from "@/lib/objetivos/metricas";
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
type Envio = Bloque & { hora: string };
type Sincronizacion = RespuestaSemaforo["sincronizacion"];
type Metrica = Envio["metricas"][number];

function dinero(valor: number | null): string {
  return valor === null ? "sin dato" : `$${num(Math.round(valor))} COP`;
}

function cantidadAgendas(valor: number): string {
  return `${num(valor)} ${valor === 1 ? "agenda" : "agendas"}`;
}

function lineasMetrica(metrica: Metrica, tipo: Envio["tipo"]): string[] {
  const lineas = [
    `${EMOJI[metrica.color]} ${DEFINICION_METRICAS_OBJETIVO[metrica.metrica].nombre}: ${dinero(metrica.costo)}`,
  ];

  if (metrica.umbral) {
    lineas.push(
      `Meta ${dinero(metrica.umbral.meta)} · aceptable ${dinero(metrica.umbral.aceptable)}`,
    );
  }
  lineas.push(`Gasto ${dinero(metrica.gasto)} · ${cantidadAgendas(metrica.agendas)}`);

  if (metrica.ayerALaMismaHora) {
    lineas.push(
      `Ayer a esta hora: ${dinero(metrica.ayerALaMismaHora.costo)} (${cantidadAgendas(metrica.ayerALaMismaHora.agendas)})`,
    );
  }
  if (metrica.diasSeguidosEnRojo > 0) {
    const dias = Number(metrica.diasSeguidosEnRojo);
    lineas.push(`🔴 ${num(dias)} ${dias === 1 ? "día seguido" : "días seguidos"} en rojo`);
  }
  if (metrica.motivo) lineas.push(MOTIVO[metrica.motivo]);
  for (const nota of metrica.notas) {
    lineas.push(`• ${nota.tipo === "problema" ? "⚠️ " : ""}${nota.texto}`);
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

export function armarMensaje(envio: Envio, sincronizacion: Sincronizacion): string {
  const titulo = envio.tipo === "cierre" ? "Cierre del día" : "Semáforo de pauta";
  const lineas = [`🚦 ${titulo} · ${envio.programa} · ${envio.hora}`];

  if (envio.error) lineas.push(`⚠️ ${envio.error}`);
  else {
    for (const metrica of envio.metricas) lineas.push(...lineasMetrica(metrica, envio.tipo));
  }

  const avisoSincronizacion = avisoDeErrorDeSincronizacion(sincronizacion);
  if (avisoSincronizacion) lineas.push(avisoSincronizacion);
  lineas.push(`Ver en el Hub: ${envio.enlaceHub}`);
  return lineas.join("\n");
}

export function armarMensajeDeLaHora(
  bloques: Bloque[],
  hora: string,
  sincronizacion: Sincronizacion,
): string {
  const texto = bloques
    .map((bloque) => armarMensaje({ ...bloque, hora }, null))
    .join("\n\n━━━━━━━━━━\n\n");
  const avisoSincronizacion = avisoDeErrorDeSincronizacion(sincronizacion);
  return avisoSincronizacion ? `${texto}\n\n${avisoSincronizacion}` : texto;
}
