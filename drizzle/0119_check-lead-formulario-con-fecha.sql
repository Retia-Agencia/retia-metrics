-- 0119 (ticket 389, M2, ADR 0121): un lead de formulario siempre tiene fecha_primera_aplicacion.
-- Despues del relleno de la 0118. NOT VALID y luego VALIDATE; lock_timeout por si hay una transaccion larga sobre leads.
SET lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_formulario_con_fecha" CHECK ("leads"."entrada" <> 'formulario' OR "leads"."fecha_primera_aplicacion" IS NOT NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "leads" VALIDATE CONSTRAINT "leads_formulario_con_fecha";
