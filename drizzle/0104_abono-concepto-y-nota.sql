SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."concepto_abono" AS ENUM('ticket', 'adicional');--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "concepto" "concepto_abono" DEFAULT 'ticket' NOT NULL;--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "nota" text;