-- ADR 0057 (cierre del 109): un programa nace inactivo y no puede estar activo sin Forms Link y
-- token de Calendly. Los dos programas de produccion ya los tienen (verificado el 28-sep), asi que el
-- CHECK no necesita arreglar datos antes.
ALTER TABLE "programs" ALTER COLUMN "activo" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_activo_con_formulario_y_token" CHECK (NOT "programs"."activo" OR ("programs"."form_url" IS NOT NULL AND "programs"."calendly_token" IS NOT NULL));