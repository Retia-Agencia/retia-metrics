SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "area_declarada_id" uuid;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_area_declarada_id_areas_id_fk" FOREIGN KEY ("area_declarada_id") REFERENCES "public"."areas"("id") ON DELETE restrict ON UPDATE no action;
