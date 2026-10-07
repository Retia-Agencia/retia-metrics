CREATE TYPE "public"."tipo_notificacion_calendly" AS ENUM('cita_nueva', 'cita_reagendada', 'cita_cancelada', 'cita_no_show', 'cita_no_show_corregida');--> statement-breakpoint
CREATE TABLE "notificaciones_calendly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"call_id" uuid NOT NULL,
	"tipo" "tipo_notificacion_calendly" NOT NULL,
	"clave_evento" text NOT NULL,
	"leida_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notificaciones_calendly_clave_no_vacia" CHECK (length(trim("notificaciones_calendly"."clave_evento")) > 0)
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "owner_novedad_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notificaciones_calendly" ADD CONSTRAINT "notificaciones_calendly_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones_calendly" ADD CONSTRAINT "notificaciones_calendly_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones_calendly" ADD CONSTRAINT "notificaciones_calendly_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones_calendly" ADD CONSTRAINT "notificaciones_calendly_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notificaciones_calendly_evento_idx" ON "notificaciones_calendly" USING btree ("program_id","tipo","clave_evento");--> statement-breakpoint
CREATE INDEX "notificaciones_calendly_no_leidas_idx" ON "notificaciones_calendly" USING btree ("user_id","program_id","created_at") WHERE "notificaciones_calendly"."leida_en" is null;--> statement-breakpoint
CREATE INDEX "notificaciones_calendly_usuario_programa_idx" ON "notificaciones_calendly" USING btree ("user_id","program_id","created_at");--> statement-breakpoint
CREATE INDEX "notificaciones_calendly_deal_idx" ON "notificaciones_calendly" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "notificaciones_calendly_call_idx" ON "notificaciones_calendly" USING btree ("call_id");--> statement-breakpoint
ALTER TABLE "notificaciones_calendly" ENABLE ROW LEVEL SECURITY;
