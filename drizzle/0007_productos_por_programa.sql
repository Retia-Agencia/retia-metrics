CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"precio_lista" numeric(10, 2) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "productos_programa_nombre_idx" ON "productos" USING btree ("program_id",lower("nombre"));