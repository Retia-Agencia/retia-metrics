-- ADR 0125 (M5): borrar un programa con leads, deals, llamadas, abonos, cohortes o fuentes falla en la base (restrict), no los arrastra.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "abonos" DROP CONSTRAINT "abonos_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "sources" DROP CONSTRAINT "sources_program_id_programs_id_fk";
--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;