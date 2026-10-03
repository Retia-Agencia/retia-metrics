-- Ola O3 (ADR 0077): recursos.categoria_id deja de ser obligatoria para que el 171 cree recursos libres, sin
-- categoria. Solo afloja: el codigo de hoy sigue mandando una categoria y nada se rompe. Medido en produccion el
-- 3-oct: 0 recursos y 6 categorias sin uso. La columna y la tabla categorias_recurso se van en el 175.
-- lock_timeout porque recursos se lee en cada pagina de Recursos (29-sep, 0043).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "recursos" ALTER COLUMN "categoria_id" DROP NOT NULL;
