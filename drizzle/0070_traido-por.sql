-- Ticket 086, ADR 0044 punto 2: quien trajo al lead, FK real a users (nunca texto). Aditiva y
-- nula: los leads de hoy quedan sin "traido por", que es lo que de verdad se sabe. leads es
-- caliente, asi que va con lock_timeout.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "traido_por_user_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_traido_por_user_id_users_id_fk" FOREIGN KEY ("traido_por_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
