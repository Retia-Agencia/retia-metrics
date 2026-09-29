-- Ticket 096 (A5, webhook de Calendly): la caja negra guarda tambien los eventos de Calendly,
-- que son del PROGRAMA y no de una fuente. Reescrita a mano sobre el borrador de drizzle-kit:
-- el borrador agregaba `program_id NOT NULL` de una vez y fallaba contra los sobres existentes.
-- Orden: columna nula -> rellenar desde la fuente -> NOT NULL -> FK -> CHECK.
ALTER TABLE "sobres_crudos" ALTER COLUMN "source_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD COLUMN "origen" text DEFAULT 'formulario' NOT NULL;--> statement-breakpoint
UPDATE "sobres_crudos" SET "program_id" = "sources"."program_id" FROM "sources" WHERE "sources"."id" = "sobres_crudos"."source_id";--> statement-breakpoint
ALTER TABLE "sobres_crudos" ALTER COLUMN "program_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD CONSTRAINT "sobres_crudos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD CONSTRAINT "sobres_crudos_origen_chk" CHECK (("sobres_crudos"."origen" = 'formulario' AND "sobres_crudos"."source_id" IS NOT NULL) OR ("sobres_crudos"."origen" = 'calendly' AND "sobres_crudos"."source_id" IS NULL));
