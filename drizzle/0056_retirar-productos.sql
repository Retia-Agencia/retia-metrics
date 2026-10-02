SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "producto_id";--> statement-breakpoint
ALTER TABLE "enlaces_pago" DROP COLUMN "producto_id";--> statement-breakpoint
DROP TABLE "productos";
