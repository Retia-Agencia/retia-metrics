SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ADD COLUMN "bytes_respuesta" integer;--> statement-breakpoint
ALTER TABLE "mcp_llamadas" ADD COLUMN "consultas" integer;