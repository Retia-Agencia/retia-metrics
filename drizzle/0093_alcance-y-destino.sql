SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "usuarios_programas_alcance" (
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ADD COLUMN "destino" text;--> statement-breakpoint
ALTER TABLE "usuarios_programas_alcance" ADD CONSTRAINT "usuarios_programas_alcance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_programas_alcance" ADD CONSTRAINT "usuarios_programas_alcance_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_programas_alcance_par_idx" ON "usuarios_programas_alcance" USING btree ("user_id","program_id");--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ADD CONSTRAINT "reportes_whatsapp_destino_chk" CHECK ("reportes_whatsapp"."destino" IS NULL OR "reportes_whatsapp"."destino" ~ '^[0-9-]+@g[.]us$');--> statement-breakpoint
ALTER TABLE "usuarios_programas_alcance" ENABLE ROW LEVEL SECURITY;
