import { z } from "zod";

export const esquemaTelefonoWhatsapp = z.string().regex(/^[0-9]{8,15}$/);

export const esquemaEntregaEstudianteNuevo = z.object({
  avisoId: z.string().uuid(),
  telefono: esquemaTelefonoWhatsapp,
  texto: z.string(),
}).strict();

export const esquemaRespuestaEstudiantesNuevos = z.object({
  entregas: z.array(esquemaEntregaEstudianteNuevo),
  sinDestinatario: z.number().int().nonnegative(),
  telefonosCs: z.array(esquemaTelefonoWhatsapp),
}).strict();

export type RespuestaEstudiantesNuevos = z.infer<typeof esquemaRespuestaEstudiantesNuevos>;

export const esquemaConfirmarEstudiantesNuevos = z.object({
  entregas: z.array(z.object({
    avisoId: z.string().uuid(),
    telefono: esquemaTelefonoWhatsapp,
  }).strict()).max(200),
}).strict();
