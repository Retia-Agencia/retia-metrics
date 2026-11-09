SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "enlaces_pago" DROP CONSTRAINT "enlaces_pago_moneda_chk";--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD CONSTRAINT "enlaces_pago_moneda_chk" CHECK ("enlaces_pago"."moneda" in ('COP', 'USD'));