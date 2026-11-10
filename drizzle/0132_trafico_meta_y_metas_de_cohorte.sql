SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."metrica_objetivo" ADD VALUE 'agendas';--> statement-breakpoint
ALTER TYPE "public"."metrica_objetivo" ADD VALUE 'inversion';--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD COLUMN "impresiones" integer;--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD COLUMN "alcance" integer;--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD COLUMN "clics_enlace" integer;--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD COLUMN "vistas_landing" integer;
