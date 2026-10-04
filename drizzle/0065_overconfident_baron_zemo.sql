SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "registrado_por_user_id" uuid;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_registrado_por_user_id_users_id_fk" FOREIGN KEY ("registrado_por_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;