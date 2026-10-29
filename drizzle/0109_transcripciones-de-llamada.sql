SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "transcripciones_llamada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"link_leido" text NOT NULL,
	"crudo" text,
	"leido_en" timestamp with time zone,
	"error" text,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_intento_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcripciones_llamada_estado_chk" CHECK (("transcripciones_llamada"."crudo" IS NOT NULL AND "transcripciones_llamada"."leido_en" IS NOT NULL AND "transcripciones_llamada"."error" IS NULL)
          OR ("transcripciones_llamada"."crudo" IS NULL AND "transcripciones_llamada"."leido_en" IS NULL AND "transcripciones_llamada"."error" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "transcripciones_llamada" ADD CONSTRAINT "transcripciones_llamada_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transcripciones_llamada_idx" ON "transcripciones_llamada" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "transcripciones_llamada_fallidas_idx" ON "transcripciones_llamada" USING btree ("call_id") WHERE "transcripciones_llamada"."error" is not null;--> statement-breakpoint
ALTER TABLE "transcripciones_llamada" ENABLE ROW LEVEL SECURITY;
