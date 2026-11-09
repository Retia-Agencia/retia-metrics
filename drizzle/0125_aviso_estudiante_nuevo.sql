SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "avisos_estudiante_nuevo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avisos_estudiante_nuevo_envios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aviso_id" uuid NOT NULL,
	"telefono" text NOT NULL,
	"enviado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telefono" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_whatsapp_telefono_chk" CHECK ("usuarios_whatsapp"."telefono" ~ '^[0-9]{8,15}$')
);
--> statement-breakpoint
ALTER TABLE "avisos_estudiante_nuevo" ADD CONSTRAINT "avisos_estudiante_nuevo_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avisos_estudiante_nuevo" ADD CONSTRAINT "avisos_estudiante_nuevo_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avisos_estudiante_nuevo_envios" ADD CONSTRAINT "avisos_estudiante_nuevo_envios_aviso_id_avisos_estudiante_nuevo_id_fk" FOREIGN KEY ("aviso_id") REFERENCES "public"."avisos_estudiante_nuevo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_whatsapp" ADD CONSTRAINT "usuarios_whatsapp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avisos_estudiante_nuevo_deal_idx" ON "avisos_estudiante_nuevo" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "avisos_estudiante_nuevo_programa_idx" ON "avisos_estudiante_nuevo" USING btree ("program_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "avisos_estudiante_nuevo_envios_par_idx" ON "avisos_estudiante_nuevo_envios" USING btree ("aviso_id","telefono");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_whatsapp_telefono_idx" ON "usuarios_whatsapp" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "usuarios_whatsapp_user_idx" ON "usuarios_whatsapp" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "avisos_estudiante_nuevo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "avisos_estudiante_nuevo_envios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usuarios_whatsapp" ENABLE ROW LEVEL SECURITY;
