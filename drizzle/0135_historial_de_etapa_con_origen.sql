SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD COLUMN "origen" "origen_cambio";--> statement-breakpoint
ALTER TABLE "mcp_vistas_previas" ENABLE ROW LEVEL SECURITY;
