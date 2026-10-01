SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "valor_vendido_usd" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_valor_vendido_no_negativo" CHECK ("deals"."valor_vendido_usd" IS NULL OR "deals"."valor_vendido_usd" >= 0);
