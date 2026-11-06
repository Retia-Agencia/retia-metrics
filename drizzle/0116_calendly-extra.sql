SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "miembros_programa_calendly_extra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membresia_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "miembros_programa_calendly_extra" ADD CONSTRAINT "miembros_programa_calendly_extra_membresia_id_miembros_programa_id_fk" FOREIGN KEY ("membresia_id") REFERENCES "public"."miembros_programa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros_programa_calendly_extra" ADD CONSTRAINT "miembros_programa_calendly_extra_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "miembros_programa_calendly_extra_idx" ON "miembros_programa_calendly_extra" USING btree ("program_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "miembros_programa_calendly_extra_par_idx" ON "miembros_programa_calendly_extra" USING btree ("membresia_id",lower("email"));--> statement-breakpoint
ALTER TABLE "miembros_programa_calendly_extra" ENABLE ROW LEVEL SECURITY;
