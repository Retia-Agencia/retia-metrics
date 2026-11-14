SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "sobres_crudos" DROP CONSTRAINT "sobres_crudos_origen_chk";--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "proveedor" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."proveedor_formulario";--> statement-breakpoint
CREATE TYPE "public"."proveedor_formulario" AS ENUM('typeform', 'dapta');--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "proveedor" SET DATA TYPE "public"."proveedor_formulario" USING "proveedor"::"public"."proveedor_formulario";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN "form30x_form_id";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN "form30x_leido_en";--> statement-breakpoint
ALTER TABLE "sobres_crudos" ADD CONSTRAINT "sobres_crudos_origen_chk" CHECK (("sobres_crudos"."origen" = 'formulario' AND "sobres_crudos"."source_id" IS NOT NULL) OR ("sobres_crudos"."origen" = 'calendly' AND "sobres_crudos"."source_id" IS NULL));