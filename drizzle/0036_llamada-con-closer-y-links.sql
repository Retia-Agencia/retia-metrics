ALTER TABLE "calls" ADD COLUMN "closer_user_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "link_calendly" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "link_grain" text;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_closer_user_id_users_id_fk" FOREIGN KEY ("closer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_closer_user_idx" ON "calls" USING btree ("closer_user_id");