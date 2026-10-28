SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "fotos_pauta" ADD COLUMN "registros_meta" integer;--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD COLUMN "registros_meta" integer;