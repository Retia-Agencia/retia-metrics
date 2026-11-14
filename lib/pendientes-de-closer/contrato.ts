import { z } from "zod";
import { esquemaTelefonoWhatsapp } from "@/lib/avisos-cs/contrato";

export const esquemaVentanaPendientes = z.enum(["manana", "tarde"]);

export const esquemaPedirAvisosPendientes = z.object({
  ventana: esquemaVentanaPendientes,
}).strict();

export const esquemaAvisoPendienteCloser = z.object({
  userId: z.string().uuid(),
  telefono: esquemaTelefonoWhatsapp,
  ventana: esquemaVentanaPendientes,
  dia: z.string().date(),
  texto: z.string().min(1),
}).strict();

export const esquemaRespuestaAvisosPendientes = z.object({
  avisos: z.array(esquemaAvisoPendienteCloser),
  sinDestinatario: z.array(z.string().uuid()),
}).strict();

export const esquemaConfirmarAvisosPendientes = z.object({
  avisos: z.array(z.object({
    userId: z.string().uuid(),
    ventana: esquemaVentanaPendientes,
    telefono: esquemaTelefonoWhatsapp,
  }).strict()).max(200),
}).strict();

export type VentanaPendientes = z.infer<typeof esquemaVentanaPendientes>;
export type AvisoPendienteCloser = z.infer<typeof esquemaAvisoPendienteCloser>;
export type RespuestaAvisosPendientes = z.infer<typeof esquemaRespuestaAvisosPendientes>;
