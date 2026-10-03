-- Ticket 157 (ADR 0076): el credito del setter y la marca del handoff. Solo agrega columnas nulas;
-- ningun dato se toca. lock_timeout porque deals es tabla caliente (29-sep, 0043).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "setter_user_id" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "handoff_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_setter_user_id_users_id_fk" FOREIGN KEY ("setter_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;