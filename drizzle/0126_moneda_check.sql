SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_moneda_chk" CHECK ("abonos"."moneda" in ('COP', 'USD'));--> statement-breakpoint
ALTER TABLE "cuentas_publicitarias" ADD CONSTRAINT "cuentas_publicitarias_moneda_chk" CHECK ("cuentas_publicitarias"."moneda" in ('COP', 'USD'));--> statement-breakpoint
ALTER TABLE "cuotas_pactadas" ADD CONSTRAINT "cuotas_pactadas_moneda_chk" CHECK ("cuotas_pactadas"."moneda" = 'USD');--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD CONSTRAINT "enlaces_pago_moneda_chk" CHECK ("enlaces_pago"."moneda" = 'USD');--> statement-breakpoint
ALTER TABLE "eventos_meta" ADD CONSTRAINT "eventos_meta_moneda_chk" CHECK ("eventos_meta"."moneda" = 'USD');--> statement-breakpoint
ALTER TABLE "fotos_pauta" ADD CONSTRAINT "fotos_pauta_moneda_chk" CHECK ("fotos_pauta"."moneda" in ('COP', 'USD'));--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD CONSTRAINT "gasto_pauta_moneda_chk" CHECK ("gasto_pauta"."moneda" in ('COP', 'USD'));