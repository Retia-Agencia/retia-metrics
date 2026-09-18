ALTER TABLE "sales" ADD COLUMN "call_id" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_call_idx" ON "sales" USING btree ("call_id");