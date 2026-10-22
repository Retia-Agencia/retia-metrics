import { z } from "zod";
import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";

const esquemaPunto = z.object({
  hora: z.string(),
  gasto: z.number(),
  agendasMeta: z.number().nullable(),
  agendasCrm: z.number(),
  costo: z.number().nullable(),
}).strict();

export const esquemaMetricaSemaforo: z.ZodType<MetricaSemaforo> = z.object({
  metrica: z.literal("costo_por_agenda"),
  color: z.enum(["exito", "alerta", "peligro", "sin_dato"]),
  motivo: z.enum(["sin_cohorte", "sin_umbral", "sin_pauta", "sin_agendas_meta"]).nullable(),
  moneda: z.literal("COP"),
  dia: z.string(),
  gasto: z.number(),
  agendasMeta: z.number().nullable(),
  agendasCrm: z.number(),
  costo: z.number().nullable(),
  umbral: z.object({ meta: z.number(), aceptable: z.number().nullable() }).strict().nullable(),
  porcentajeDelUmbral: z.number().nullable(),
  comparacion: z.object({
    dia: z.string(),
    gasto: z.number(),
    agendasMeta: z.number().nullable(),
    agendasCrm: z.number(),
    costo: z.number().nullable(),
    etiqueta: z.enum(["ayer a esta hora", "día anterior"]),
  }).strict().nullable(),
  trayectoria: z.array(esquemaPunto),
  racha: z.object({
    color: z.enum(["exito", "alerta", "peligro"]),
    dias: z.number(),
  }).strict().nullable(),
  campanas: z.array(z.object({
    nombre: z.string(),
    gasto: z.number(),
    agendasMeta: z.number().nullable(),
    costo: z.number().nullable(),
  }).strict()),
  notas: z.array(z.object({
    tipo: z.enum(["problema", "info"]),
    texto: z.string(),
  }).strict()),
}).strict();

const esquemaSincronizacion = z.object({
  estado: z.enum(["ok", "reciente", "corriendo", "error"]),
  ultimaFoto: z.string().nullable(),
}).strict();

export const esquemaBloque = z.object({
  programa: z.string(),
  tipo: z.enum(["dia", "cierre"]),
  enlaceHub: z.string().url(),
  metricas: z.array(esquemaMetricaSemaforo),
  cuentasMeta: z.array(z.object({
    nombre: z.string(),
    estado: z.enum(["al_dia", "problema"]),
    detalle: z.string().nullable(),
  }).strict()),
  trazaRota: z.array(z.object({
    fuente: z.string(),
    pagos: z.number(),
    pagosSinId: z.number(),
    pagosSinFbclid: z.number(),
    sinId: z.boolean(),
    fbclidRoto: z.boolean(),
  }).strict()).optional(),
  error: z.string().nullable(),
}).strict();

const esquemaEnvio = z.object({
  tipo: z.enum(["semaforo", "horas_agenda"]),
  hora: z.string(),
  destino: z.string().nullable(),
  texto: z.string(),
  bloques: z.array(esquemaBloque),
}).strict();

const esquemaConfiguracion = z.object({
  programa: z.string(),
  destino: z.string().nullable(),
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
