CREATE TABLE "cuadres_pauta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"gasto_meta" numeric(14, 2) NOT NULL,
	"gasto_crm" numeric(14, 2) NOT NULL,
	"revisado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuadres_pauta" ADD CONSTRAINT "cuadres_pauta_cuenta_id_cuentas_publicitarias_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_publicitarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuadres_pauta_cuenta_fecha_idx" ON "cuadres_pauta" USING btree ("cuenta_id","fecha");