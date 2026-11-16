-- ADR 0047: toda tabla de public nace con RLS. Se olvido en la 0147 (sin politicas, anon y authenticated no ven filas).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "cuadres_pauta" ENABLE ROW LEVEL SECURITY;
