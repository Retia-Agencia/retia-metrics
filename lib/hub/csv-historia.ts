import { resolverCanal } from "@/lib/atribucion/canal";
import { celdaCsv } from "@/lib/deals/csv-deals";
import { NOMBRE_DE_ETAPA, type EtapaDeal } from "@/lib/deals/etapas";
import { fecha, fechaHoraEnBogota, monto } from "@/lib/format";
import type { EventoDeRecorrido } from "@/lib/queries/hechos/recorrido";
import type { FichaDeLead, EnvioDeLaFicha } from "@/lib/queries/ficha-lead";
import type { FilaDeMetrica } from "@/lib/queries/metricas-con-filas";

function csv(encabezados: readonly string[], filas: readonly (string | null)[][]): string {
  return `﻿${[encabezados, ...filas].map((fila) => fila.map(celdaCsv).join(",")).join("\r\n")}`;
}

function valorDe(envio: EnvioDeLaFicha | undefined, campo: string): string | null {
  const valor = envio?.campos.find((item) => item.campo === campo)?.valor;
  return valor?.tipo === "valor" ? valor.texto : null;
}

function origenDe(envio: EnvioDeLaFicha | undefined) {
  if (!envio) return { fecha: null, canal: null, campana: null };
  const source = valorDe(envio, "UTM Source");
  const medium = valorDe(envio, "UTM Medium");
  const resuelto = resolverCanal({ source, medium });
  return {
    fecha: fechaHoraEnBogota(envio.fecha),
    canal: resuelto.regla === "sin_utm" ? "Sin UTM" : resuelto.canal?.nombre ?? "Sin plataforma",
    campana: valorDe(envio, "UTM Campaign"),
  };
}

function etapaLegible(etapa: string | null): string {
  return etapa && etapa in NOMBRE_DE_ETAPA ? NOMBRE_DE_ETAPA[etapa as EtapaDeal] : "Sin deal";
}

export function csvDeLeadsDeLista({
  filas,
  fichas,
  veEquipo,
}: {
  filas: readonly FilaDeMetrica[];
  fichas: ReadonlyMap<string, FichaDeLead>;
  veEquipo: boolean;
}): string {
  const encabezados = ["Nombre", "Correo", "Teléfono", "Etapa", "Fecha", "Importe", ...(veEquipo ? ["Closer"] : []), "Primer envío: fecha", "Primer envío: canal", "Primer envío: campaña", "Último envío: fecha", "Último envío: canal", "Último envío: campaña"];
  const contenido = filas.flatMap((fila) => {
    const leadId = fila.persona?.leadId;
    const ficha = leadId ? fichas.get(leadId) : undefined;
    if (!ficha) return [];
    const cronologicos = [...ficha.envios].reverse();
    const primero = origenDe(cronologicos[0]);
    const ultimo = origenDe(cronologicos.at(-1));
    return [[
      ficha.nombre,
      ficha.email,
      ficha.telefono,
      etapaLegible(fila.etapa),
      fecha(fila.fecha),
      fila.monto !== null && fila.moneda ? monto(fila.monto, fila.moneda) : null,
      ...(veEquipo ? [fila.closer] : []),
      primero.fecha, primero.canal, primero.campana,
      ultimo.fecha, ultimo.canal, ultimo.campana,
    ]];
  });
  return csv(encabezados, contenido);
}

export function csvDeTraza({
  leadIds,
  fichas,
  recorridos,
  veEquipo,
}: {
  leadIds: readonly string[];
  fichas: ReadonlyMap<string, FichaDeLead>;
  recorridos: ReadonlyMap<string, EventoDeRecorrido[]>;
  veEquipo: boolean;
}): string {
  const encabezados = ["Nombre", "Correo", "Teléfono", "Fecha", "Evento", "Detalle", "Importe", "Anulado", ...(veEquipo ? ["Closer"] : []), "Pregunta", "Respuesta"];
  const filas = leadIds.flatMap((leadId) => {
    const ficha = fichas.get(leadId);
    if (!ficha) return [];
    return (recorridos.get(leadId) ?? []).flatMap((evento) => {
      const respuestas = evento.respuestas?.length ? evento.respuestas : [{ pregunta: null, respuesta: null }];
      return respuestas.map((respuesta) => [
        ficha.nombre,
        ficha.email,
        ficha.telefono,
        fechaHoraEnBogota(evento.fecha),
        evento.tipo === "envio" ? "Envío" : evento.tipo === "cita" ? "Cita" : evento.tipo === "etapa" ? "Etapa" : "Abono",
        evento.detalle,
        evento.monto !== null && evento.moneda ? monto(evento.monto, evento.moneda) : null,
        evento.anulado ? "Sí" : "No",
        ...(veEquipo ? [evento.closer] : []),
        respuesta.pregunta,
        respuesta.respuesta,
      ]);
    });
  });
  return csv(encabezados, filas);
}
