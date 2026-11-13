import { z } from "zod";
import { TIPOS_DE_ALERTA } from "@/lib/alertas/registro";

export const respuestaAlertasSchema = z.object({
  generadoEn: z.string().datetime(),
  alertas: z.array(z.object({
    clave: z.string(),
    tipo: z.enum(TIPOS_DE_ALERTA),
    severidad: z.enum(["critica", "aviso"]),
    texto: z.string(),
  }).strict()),
}).strict();

export const respuestaCierreSchema = z.object({
  generadoEn: z.string().datetime(),
  texto: z.string().min(1),
}).strict();
