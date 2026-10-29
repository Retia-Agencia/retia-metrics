SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "piezas" ADD COLUMN "nombre" text;--> statement-breakpoint
-- Las piezas que ya existen se nombran con lo que se sabe de ellas ("Reel · instagram"); media las renombra desde la app.
UPDATE "piezas" SET "nombre" = (SELECT "tipos_pieza"."nombre" FROM "tipos_pieza" WHERE "tipos_pieza"."id" = "piezas"."tipo_id") || ' · ' || "piezas"."red";--> statement-breakpoint
ALTER TABLE "piezas" ALTER COLUMN "nombre" SET NOT NULL;
