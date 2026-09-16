CREATE TABLE "plataformas_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_log" ADD COLUMN "user_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "plataformas_pago_nombre_idx" ON "plataformas_pago" USING btree (lower("nombre"));--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "plataformas_pago" ("nombre") VALUES ('PayPal'),('MercadoPago'),('Zelle'),('DollarApp'),('Bancolombia'),('Global66'),('Hotmart');