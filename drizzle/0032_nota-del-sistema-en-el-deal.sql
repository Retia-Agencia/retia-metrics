-- Ticket 052: la regla de deals deja una NOTA en el deal cuando la cita de Calendly no esta vigente.
-- deal_actividades.user_id nulo = el sistema (como deal_etapa_historial y deals.creado_por). El
-- sistema solo deja notas: un contacto siempre es de una persona (CHECK). Hoy la tabla esta vacia.
ALTER TABLE "deal_actividades" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD CONSTRAINT "deal_actividades_contacto_con_usuario" CHECK ("deal_actividades"."tipo" <> 'contacto' OR "deal_actividades"."user_id" IS NOT NULL);