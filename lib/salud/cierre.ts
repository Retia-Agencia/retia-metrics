import { and, eq } from "drizzle-orm";
import { alertasActivas } from "@/lib/alertas/registro";
import { resumenDelDia } from "@/lib/avisos-cs/pendientes";
import { reportesActivos } from "@/lib/catalogo/reportes-whatsapp";
import { programs, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fechaDeInstanteEnBogota, horaEnBogota, instanteDeBogota } from "@/lib/format";
import { recibidosDesde, saludDeFuentes } from "@/lib/queries/salud-fuentes";

function fechaDelCierre(ahora: Date): string {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).formatToParts(ahora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value.replace(".", "") ?? "";
  return `${valor("weekday")} ${valor("day")} ${valor("month")}`;
}

export async function textoDeCierre(db: Db, ahora: Date): Promise<string> {
  const dia = fechaDeInstanteEnBogota(ahora);
  const desde = instanteDeBogota(dia, "00:00");
  if (!desde) throw new Error("No se pudo calcular el inicio del día en Bogotá.");

  const [alertas, fuentes, recibidos, inactivas, reportes, estudiantes] = await Promise.all([
    alertasActivas(db, ahora),
    saludDeFuentes(db, ahora),
    recibidosDesde(db, desde),
    db
      .select({ programa: programs.nombre, nombre: sources.nombre })
      .from(sources)
      .innerJoin(programs, eq(programs.id, sources.programId))
      .where(and(eq(sources.tipo, "webhook"), eq(sources.activo, false)))
      .orderBy(programs.nombre, sources.orden),
    reportesActivos(db),
    resumenDelDia(db, desde),
  ]);

  const criticas = alertas.filter((alerta) => alerta.severidad === "critica").length;
  const avisos = alertas.length - criticas;
  const estado = criticas === 0 ? "🟢 Sin alertas críticas" : `🔴 ${criticas} ${criticas === 1 ? "alerta crítica" : "alertas críticas"}`;
  const lineas = [
    `🩺 Cierre del CRM · ${fechaDelCierre(ahora)}`,
    `${estado}${avisos > 0 ? ` · ${avisos} ${avisos === 1 ? "aviso" : "avisos"}` : ""}`,
    "",
    "*Formularios hoy*",
    ...fuentes.map((fuente) => {
      const n = recibidos.get(fuente.sourceId) ?? 0;
      if (n === 0) return `• ${fuente.programaNombre} · ${fuente.nombre}: 0 envíos`;
      return `• ${fuente.programaNombre} · ${fuente.nombre}: ${n} envíos (último ${horaEnBogota(fuente.ultimo!)})`;
    }),
    "",
    "*Alertas abiertas*",
    ...(alertas.length === 0 ? ["Ninguna."] : alertas.map((alerta) => alerta.texto)),
  ];

  if (inactivas.length > 0) {
    lineas.push("", "*Fuentes sin activar*", ...inactivas.map((fuente) => `• ${fuente.programa} · ${fuente.nombre}`));
  }

  const calendly = new Map<string, { programa: string; llamadas: number; deals: number }>();
  for (const fuente of fuentes) {
    if (fuente.llamadasSueltasViejas === 0 && fuente.dealsConCitaSinLlamada === 0) continue;
    calendly.set(fuente.programId, {
      programa: fuente.programaNombre,
      llamadas: fuente.llamadasSueltasViejas,
      deals: fuente.dealsConCitaSinLlamada,
    });
  }
  if (calendly.size > 0) {
    lineas.push(
      "",
      "*Calendly*",
      ...[...calendly.values()].map((fila) =>
        `• ${fila.programa}: ${[
          fila.llamadas > 0 ? `${fila.llamadas} ${fila.llamadas === 1 ? "cita sin asignar" : "citas sin asignar"} hace más de 24 h` : null,
          fila.deals > 0 ? `${fila.deals} ${fila.deals === 1 ? "deal con cita sin llamada" : "deals con cita sin llamada"}` : null,
        ].filter((parte) => parte !== null).join(" · ")}`),
    );
  }

  lineas.push("", "*Avisos cableados*");
  if (reportes.length === 0) {
    lineas.push("• Semáforo de pauta: apagado");
  } else {
    lineas.push(...reportes.map((reporte) => {
      const ordenadas = [...reporte.horas].sort((a, b) => a - b);
      const seguidas = ordenadas.length > 2 && ordenadas.every((hora, i) => i === 0 || hora === ordenadas[i - 1] + 1);
      const horas = seguidas
        ? `cada hora de ${ordenadas[0]}h a ${ordenadas[ordenadas.length - 1]}h`
        : ordenadas.map((hora) => `${hora}h`).join(", ");
      const cierre = reporte.horaCierre === null ? "—" : `${reporte.horaCierre}h`;
      return `• Semáforo de pauta: ${reporte.programa} (${horas} + cierre ${cierre})`;
    }));
  }
  lineas.push(
    `• Estudiantes nuevos a CS: ${estudiantes.avisos} hoy, ${estudiantes.entregados} entregados`,
    "• Alertas técnicas: este grupo, cada 5 minutos",
  );
  return lineas.join("\n");
}
