SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "change_log" DROP CONSTRAINT "change_log_sync_run_id_sync_runs_id_fk";--> statement-breakpoint
ALTER TABLE "change_log" DROP COLUMN "sync_run_id";--> statement-breakpoint
ALTER TABLE "sync_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sync_runs";--> statement-breakpoint
DROP TYPE "public"."estado_sync";
