-- Ticket 126 parte B (decision de Mani del 29-sep): el token de la API de Typeform vive en
-- la fuente, con las reglas del secreto del webhook. Aditiva y nula: ninguna fuente lo tiene
-- hasta que alguien lo carga. sources la lee cada envio del webhook, asi que va con lock_timeout.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "typeform_token" text;
