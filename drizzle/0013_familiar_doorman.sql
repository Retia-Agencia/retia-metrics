ALTER TABLE "abonos" ADD COLUMN "anulado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "anulado_por" uuid;--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "anulado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "anulado_por" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "anulado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "anulado_por" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_anulacion_completa" CHECK (("abonos"."anulado_en" IS NULL AND "abonos"."anulado_por" IS NULL AND "abonos"."motivo_anulacion" IS NULL)
          OR ("abonos"."anulado_en" IS NOT NULL AND "abonos"."anulado_por" IS NOT NULL
              AND length(trim("abonos"."motivo_anulacion")) > 0));--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_anulacion_completa" CHECK (("calls"."anulado_en" IS NULL AND "calls"."anulado_por" IS NULL AND "calls"."motivo_anulacion" IS NULL)
          OR ("calls"."anulado_en" IS NOT NULL AND "calls"."anulado_por" IS NOT NULL
              AND length(trim("calls"."motivo_anulacion")) > 0));--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_anulacion_completa" CHECK (("sales"."anulado_en" IS NULL AND "sales"."anulado_por" IS NULL AND "sales"."motivo_anulacion" IS NULL)
          OR ("sales"."anulado_en" IS NOT NULL AND "sales"."anulado_por" IS NOT NULL
              AND length(trim("sales"."motivo_anulacion")) > 0));