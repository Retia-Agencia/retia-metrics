SET lock_timeout = '5s';--> statement-breakpoint
-- 415: vuelve el objetivo costo_por_venta, que la 0133 retiró por no tener lector; ahora lo lee la fila Costo por venta
-- de Hub › Pauta (estadoDeCeldaSemanal). El CHECK de moneda lo incluye (un costo lleva moneda) y compara como texto: un
-- valor recién agregado a un enum no se puede usar como literal en la misma transacción. Ninguna fila existente cambia.
ALTER TYPE "public"."metrica_objetivo" ADD VALUE 'costo_por_venta';--> statement-breakpoint
ALTER TABLE "objetivos" DROP CONSTRAINT "objetivos_moneda_de_costo_chk";--> statement-breakpoint
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_moneda_de_costo_chk" CHECK (("objetivos"."metrica"::text in ('costo_por_agenda', 'inversion', 'costo_por_venta')) = ("objetivos"."moneda" is not null));