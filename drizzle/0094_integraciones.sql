SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."tipo_integracion" AS ENUM('dapta', 'typeform', 'calendly', 'meta');--> statement-breakpoint
CREATE TABLE "integraciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"tipo" "tipo_integracion" NOT NULL,
	"secretos" jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"probada_en" timestamp with time zone,
	"actualizada_por_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "programs" DROP CONSTRAINT "programs_activo_con_token";--> statement-breakpoint
ALTER TABLE "integraciones" ADD CONSTRAINT "integraciones_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integraciones" ADD CONSTRAINT "integraciones_actualizada_por_user_id_users_id_fk" FOREIGN KEY ("actualizada_por_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integraciones_programa_tipo_idx" ON "integraciones" USING btree ("program_id","tipo");--> statement-breakpoint
-- ADR 0095 punto 4: los secretos vivos se copian DENTRO de la base; ningun valor pasa por un
-- script ni por un archivo. Las columnas viejas quedan sin lector y se borran en el paso 2.
-- probada_en queda nula: la copia no prueba nada contra el proveedor.
INSERT INTO "integraciones" ("program_id", "tipo", "secretos")
SELECT "id", 'calendly', jsonb_strip_nulls(jsonb_build_object('token', "calendly_token", 'claveFirma', "calendly_signing_key"))
FROM "programs"
WHERE "calendly_token" IS NOT NULL;--> statement-breakpoint
-- Typeform: el token es de la cuenta; medido el 19-oct, un solo valor por programa. Si hubiera
-- dos, gana el de una fuente activa.
INSERT INTO "integraciones" ("program_id", "tipo", "secretos")
SELECT DISTINCT ON ("program_id") "program_id", 'typeform', jsonb_build_object('token', "typeform_token")
FROM "sources"
WHERE "typeform_token" IS NOT NULL
ORDER BY "program_id", "activo" DESC, "id";--> statement-breakpoint
-- Meta pasa a ser por programa: cada programa con cuentas publicitarias recibe el token de la
-- conexion global activa (hoy el mismo valor en todos).
INSERT INTO "integraciones" ("program_id", "tipo", "secretos", "config")
SELECT p."id", 'meta', jsonb_build_object('token', m."token_secreto"), jsonb_build_object('nombre', m."nombre")
FROM "programs" p
CROSS JOIN "meta_conexiones" m
WHERE m."activo" AND EXISTS (SELECT 1 FROM "cuentas_publicitarias" c WHERE c."program_id" = p."id");
