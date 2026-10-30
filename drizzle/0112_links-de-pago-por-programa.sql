SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "enlace_pago_id" uuid;--> statement-breakpoint
ALTER TABLE "enlaces_pago" ADD COLUMN "nombre" text NOT NULL;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_enlace_pago_id_enlaces_pago_id_fk" FOREIGN KEY ("enlace_pago_id") REFERENCES "public"."enlaces_pago"("id") ON DELETE restrict ON UPDATE no action;