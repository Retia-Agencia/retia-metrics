-- 131 y 130 (ADR 0064, ADR 0055): varios formularios activos por programa, y Dapta como proveedor.
-- `sources` se lee en cada webhook: si un candado no llega en 5 s, falla y se reintenta (AGENTS.md).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."proveedor_formulario" ADD VALUE 'dapta';--> statement-breakpoint
DROP INDEX "sources_una_activa_por_programa_idx";
