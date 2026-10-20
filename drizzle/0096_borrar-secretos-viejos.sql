SET lock_timeout = '5s';--> statement-breakpoint
DROP TABLE "meta_conexiones";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "calendly_token";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "calendly_signing_key";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN "typeform_token";