-- ADR 0047: toda tabla de public nace con RLS. Se olvido en la 0130 (tabla vacia; sin politicas, anon y authenticated no ven filas).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "proyecciones_roas" ENABLE ROW LEVEL SECURITY;
