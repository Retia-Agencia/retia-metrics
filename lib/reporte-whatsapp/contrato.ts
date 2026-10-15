import { z } from "zod";
import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";

const esquemaPunto = z.object({
  hora: z.string(),
  gasto: z.number(),
  agendas: z.number(),
  costo: z.number().nullable(),
}).strict();

export const esquemaMetricaSemaforo: z.ZodType<MetricaSemaforo> = z.object({
  metrica: z.literal("costo_por_agenda"),
  color: z.enum(["exito", "alerta", "peligro", "sin_dato"]),
  motivo: z.enum(["sin_cohorte", "sin_umbral", "sin_pauta", "sin_referencia"]).nullable(),
  moneda: z.literal("COP"),
  gasto: z.number(),
  agendas: z.number(),
  costo: z.number().nullable(),
  umbral: z.object({ meta: z.number(), aceptable: z.number().nullable() }).strict().nullable(),
  porcentajeDelUmbral: z.number().nullable(),
  ayerALaMismaHora: z.object({
    dia: z.string(),
    gasto: z.number(),
    agendas: z.number(),
    costo: z.number().nullable(),
  }).strict().nullable(),
  trayectoria: z.array(esquemaPunto),
  diasSeguidosEnRojo: z.number(),
  agendasMeta: z.number().nullable(),
  campanas: z.tuple([]),
  notas: z.array(z.object({
    tipo: z.enum(["problema", "info"]),
    texto: z.string(),
  }).strict()),
}).strict();

const esquemaSincronizacion = z.object({
  estado: z.enum(["ok", "reciente", "corriendo", "error"]),
  ultimaFoto: z.string().nullable(),
}).strict();

const esquemaEnvio = z.object({
  programa: z.string(),
  destino: z.string(),
  tipo: z.enum(["dia", "cierre"]),
  hora: z.string(),
  enlaceHub: z.string().url(),
  metricas: z.array(esquemaMetricaSemaforo),
  error: z.string().nullable(),
  texto: z.string(),
}).strict();

const esquemaConfiguracion = z.object({
  programa: z.string(),
  destino: z.string(),
  horas: z.array(z.string()),
  horaCierre: z.string().nullable(),
}).strict();

export const esquemaRespuestaSemaforo = z.object({
  generadoEn: z.string(),
  sincronizacion: esquemaSincronizacion.nullable(),
  envios: z.array(esquemaEnvio),
  configuracion: z.array(esquemaConfiguracion),
}).strict();

export type RespuestaSemaforo = z.infer<typeof esquemaRespuestaSemaforo>;
