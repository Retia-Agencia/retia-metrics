-- ADR 0054 (enmienda del 27-sep): el Estado de llegada lo manda el formulario con los nombres de
-- la hoja. Cuatro valores pasan a tres: incompleto y sin_recursos son Descartado.
-- Reescrita a mano: el borrador de drizzle-kit casteaba los valores viejos al tipo nuevo sin
-- traducirlos, y habria fallado con cualquier fila calificada.
ALTER TABLE "leads" ALTER COLUMN "calificacion" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "calificacion" SET DATA TYPE text;--> statement-breakpoint
UPDATE "leads" SET "calificacion" = CASE "calificacion"
  WHEN 'incompleto' THEN 'descartado'
  WHEN 'sin_recursos' THEN 'descartado'
  WHEN 'con_agenda' THEN 'con_calendly'
  WHEN 'setteo' THEN 'setteo_no_calificado'
END WHERE "calificacion" IS NOT NULL;--> statement-breakpoint
UPDATE "submissions" SET "calificacion" = CASE "calificacion"
  WHEN 'incompleto' THEN 'descartado'
  WHEN 'sin_recursos' THEN 'descartado'
  WHEN 'con_agenda' THEN 'con_calendly'
  WHEN 'setteo' THEN 'setteo_no_calificado'
END WHERE "calificacion" IS NOT NULL;--> statement-breakpoint
DROP TYPE "public"."calificacion_envio";--> statement-breakpoint
CREATE TYPE "public"."calificacion_envio" AS ENUM('descartado', 'setteo_no_calificado', 'con_calendly');--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "calificacion" SET DATA TYPE "public"."calificacion_envio" USING "calificacion"::"public"."calificacion_envio";--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "calificacion" SET DATA TYPE "public"."calificacion_envio" USING "calificacion"::"public"."calificacion_envio";
