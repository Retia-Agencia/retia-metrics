CREATE TABLE "avisos_pendientes_closer_envios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"ventana" text NOT NULL,
	"telefono" text NOT NULL,
	"enviado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avisos_pendientes_closer_envios_ventana_chk" CHECK ("avisos_pendientes_closer_envios"."ventana" IN ('manana', 'tarde'))
);
--> statement-breakpoint
ALTER TABLE "avisos_pendientes_closer_envios" ADD CONSTRAINT "avisos_pendientes_closer_envios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avisos_pendientes_closer_envios_ventana_idx" ON "avisos_pendientes_closer_envios" USING btree ("user_id","dia","ventana");