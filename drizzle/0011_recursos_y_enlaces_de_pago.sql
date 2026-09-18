CREATE TABLE "categorias_recurso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enlaces_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"producto_id" uuid,
	"plataforma_id" uuid NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"url" text NOT NULL,
	"vigente" boolean DEFAULT true NOT NULL,
	"reemplaza_a" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recursos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"categoria_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"url" text NOT NULL,
	"vigente" boolean DEFAULT true NOT NULL,
	"reemplaza_a" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD CONSTRAINT "enlaces_pago_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD CONSTRAINT "enlaces_pago_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD CONSTRAINT "enlaces_pago_plataforma_id_plataformas_pago_id_fk" FOREIGN KEY ("plataforma_id") REFERENCES "public"."plataformas_pago"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD CONSTRAINT "enlaces_pago_reemplaza_a_enlaces_pago_id_fk" FOREIGN KEY ("reemplaza_a") REFERENCES "public"."enlaces_pago"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_categoria_id_categorias_recurso_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_recurso"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_reemplaza_a_recursos_id_fk" FOREIGN KEY ("reemplaza_a") REFERENCES "public"."recursos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_recurso_nombre_idx" ON "categorias_recurso" USING btree (lower("nombre"));--> statement-breakpoint
CREATE INDEX "enlaces_pago_programa_idx" ON "enlaces_pago" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recursos_vigente_idx" ON "recursos" USING btree (coalesce("program_id", '00000000-0000-0000-0000-000000000000'::uuid),"categoria_id",lower("titulo")) WHERE "recursos"."vigente" = true and "recursos"."activo" = true;--> statement-breakpoint
CREATE INDEX "recursos_programa_idx" ON "recursos" USING btree ("program_id");