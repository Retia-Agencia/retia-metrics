SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "reportes_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"activo" boolean DEFAULT false NOT NULL,
	"destino" text,
	"horas" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"hora_cierre" integer,
	"metricas" "metrica_objetivo"[] DEFAULT '{}'::metrica_objetivo[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reportes_whatsapp_horas_chk" CHECK ("reportes_whatsapp"."horas" <@ array[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]),
	CONSTRAINT "reportes_whatsapp_hora_cierre_chk" CHECK ("reportes_whatsapp"."hora_cierre" is null or "reportes_whatsapp"."hora_cierre" between 0 and 23),
	CONSTRAINT "reportes_whatsapp_activo_completo_chk" CHECK (not "reportes_whatsapp"."activo" or ("reportes_whatsapp"."destino" is not null and (cardinality("reportes_whatsapp"."horas") > 0 or "reportes_whatsapp"."hora_cierre" is not null)))
);
--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ADD CONSTRAINT "reportes_whatsapp_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reportes_whatsapp_programa_idx" ON "reportes_whatsapp" USING btree ("program_id");