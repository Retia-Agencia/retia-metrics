-- Ticket 105 (ADR 0055): la fuente webhook. Un formulario es una fila: tipo 'webhook', su
-- proveedor (que adaptador lee el payload) y el secreto HMAC, que escribe solo rotarSecretoDeFuente
-- para que nunca pase por change_log. El CHECK compara como texto porque 'webhook' se agrega al enum
-- en esta misma transaccion.
CREATE TYPE "public"."proveedor_formulario" AS ENUM('typeform');--> statement-breakpoint
ALTER TYPE "public"."tipo_fuente" ADD VALUE 'webhook';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "proveedor" "proveedor_formulario";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "secreto_webhook" text;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_webhook_con_proveedor" CHECK ("sources"."tipo"::text <> 'webhook' OR "sources"."proveedor" IS NOT NULL);