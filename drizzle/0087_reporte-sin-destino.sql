SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" DROP CONSTRAINT "reportes_whatsapp_activo_completo_chk";--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" DROP COLUMN "destino";--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ADD CONSTRAINT "reportes_whatsapp_activo_completo_chk" CHECK (not "reportes_whatsapp"."activo" or (cardinality("reportes_whatsapp"."horas") > 0 or "reportes_whatsapp"."hora_cierre" is not null));
