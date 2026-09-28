-- Ticket 109 (ADR 0057): el programa lleva la URL base de su formulario y su token de Calendly.
-- Nulas: los dos programas activos no tienen valores todavia. El CHECK que las exija en todo
-- programa activo va en otra migracion, despues de que Mani las cargue desde la app.
ALTER TABLE "programs" ADD COLUMN "form_url" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "calendly_token" text;