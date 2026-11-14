SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "estado_hoja";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "posicion_en_hoja";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "version_puntaje";