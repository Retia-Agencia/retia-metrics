SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."rol" ADD VALUE 'media';--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "corte_pago_rapido_dias" integer;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_corte_pago_rapido_positivo" CHECK ("programs"."corte_pago_rapido_dias" IS NULL OR "programs"."corte_pago_rapido_dias" > 0);