CREATE TABLE "calificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creador_id" uuid,
	"tematica_id" uuid,
	"external_id" text,
	"titulo" text NOT NULL,
	"guion" text NOT NULL,
	"resultado" text NOT NULL,
	"calificacion" text,
	"referente" text,
	"url_referente" text,
	"idioma" text,
	"vistas" bigint,
	"me_gusta" bigint,
	"seguidores" bigint,
	"engagement" numeric,
	"heat_score" numeric,
	"relevancia_score" numeric,
	"relevancia_razon" text,
	"viral_por_tamano" boolean,
	"notas_equipo" text,
	"calificada_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidatos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creador_id" uuid,
	"tematica_id" uuid,
	"external_id" text,
	"titulo" text NOT NULL,
	"guion" text,
	"idioma" text,
	"miniatura_url" text,
	"referente" text,
	"url_referente" text,
	"vistas" bigint,
	"me_gusta" bigint,
	"seguidores" bigint,
	"engagement" numeric,
	"heat_score" numeric,
	"prescore_metrico" numeric,
	"relevancia_score" numeric,
	"relevancia_razon" text,
	"viral_por_tamano" boolean DEFAULT false NOT NULL,
	"calificacion" text,
	"estado" text NOT NULL,
	"calificado_en" timestamp with time zone,
	"notas_equipo" text,
	"huella_guion" text,
	"duracion_seg" numeric,
	"cobertura_seg" numeric,
	"origen" text NOT NULL,
	"fuente_transcript" text,
	"publicado_en" timestamp with time zone,
	"corrida_externa" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colecciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creador_id" uuid,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colecciones_videos" (
	"coleccion_id" uuid NOT NULL,
	"red" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"agregado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "colecciones_videos_pk" UNIQUE("coleccion_id","red","external_id")
);
--> statement-breakpoint
CREATE TABLE "descartes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tematica_id" uuid,
	"external_id" text,
	"titulo" text NOT NULL,
	"guion" text,
	"referente" text,
	"url_referente" text,
	"relevancia_score" numeric,
	"relevancia_razon" text,
	"miniatura_url" text,
	"veredicto" text,
	"origen" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guiones_limpios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"red" text NOT NULL,
	"external_id" text NOT NULL,
	"creador_id" uuid,
	"texto" text NOT NULL,
	"modelo" text NOT NULL,
	"criterios_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"red" text NOT NULL,
	"notas" text,
	"activo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referentes_sugeridos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"red" text,
	"afinidad" numeric,
	"razon" text,
	"seguidores" bigint,
	"bio" text,
	"url" text,
	"semillas" text,
	"estado" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referentes_sugeridos_tematicas" (
	"sugerido_id" uuid NOT NULL,
	"tematica_id" uuid NOT NULL,
	CONSTRAINT "referentes_sugeridos_tematicas_pk" UNIQUE("sugerido_id","tematica_id")
);
--> statement-breakpoint
CREATE TABLE "referentes_tematicas" (
	"referente_id" uuid NOT NULL,
	"tematica_id" uuid NOT NULL,
	CONSTRAINT "referentes_tematicas_pk" UNIQUE("referente_id","tematica_id")
);
--> statement-breakpoint
CREATE TABLE "tandas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tematicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creador_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"criterios_relevancia" text NOT NULL,
	"criterios_aprendidos" text,
	"advertencia_criterios" text,
	"redes" text[] DEFAULT '{}'::text[] NOT NULL,
	"meta_entrega" integer,
	"perfil_limpieza" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"red" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"estado" text NOT NULL,
	"guion" text,
	"idioma" text,
	"error" text,
	"origen" text NOT NULL,
	"modo" text,
	"cobertura_seg" numeric,
	"duracion_seg" numeric,
	"tanda_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"procesada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "traslado_cockpit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tabla" text NOT NULL,
	"fila_id" uuid NOT NULL,
	"ref_cockpit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos_grabados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"red" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"grabado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos_referentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"red" text NOT NULL,
	"external_id" text NOT NULL,
	"titulo" text,
	"referente" text,
	"miniatura_url" text,
	"vistas" bigint,
	"me_gusta" bigint,
	"seguidores" bigint,
	"duracion_seg" numeric,
	"fuente" text NOT NULL,
	"traido_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_creador_id_creadores_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."creadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_tematica_id_tematicas_id_fk" FOREIGN KEY ("tematica_id") REFERENCES "public"."tematicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_creador_id_creadores_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."creadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_tematica_id_tematicas_id_fk" FOREIGN KEY ("tematica_id") REFERENCES "public"."tematicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colecciones" ADD CONSTRAINT "colecciones_creador_id_creadores_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."creadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colecciones_videos" ADD CONSTRAINT "colecciones_videos_coleccion_id_colecciones_id_fk" FOREIGN KEY ("coleccion_id") REFERENCES "public"."colecciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "descartes" ADD CONSTRAINT "descartes_tematica_id_tematicas_id_fk" FOREIGN KEY ("tematica_id") REFERENCES "public"."tematicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guiones_limpios" ADD CONSTRAINT "guiones_limpios_creador_id_creadores_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."creadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referentes_sugeridos_tematicas" ADD CONSTRAINT "referentes_sugeridos_tematicas_sugerido_id_referentes_sugeridos_id_fk" FOREIGN KEY ("sugerido_id") REFERENCES "public"."referentes_sugeridos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referentes_sugeridos_tematicas" ADD CONSTRAINT "referentes_sugeridos_tematicas_tematica_id_tematicas_id_fk" FOREIGN KEY ("tematica_id") REFERENCES "public"."tematicas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referentes_tematicas" ADD CONSTRAINT "referentes_tematicas_referente_id_referentes_id_fk" FOREIGN KEY ("referente_id") REFERENCES "public"."referentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referentes_tematicas" ADD CONSTRAINT "referentes_tematicas_tematica_id_tematicas_id_fk" FOREIGN KEY ("tematica_id") REFERENCES "public"."tematicas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tematicas" ADD CONSTRAINT "tematicas_creador_id_creadores_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."creadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripciones" ADD CONSTRAINT "transcripciones_tanda_id_tandas_id_fk" FOREIGN KEY ("tanda_id") REFERENCES "public"."tandas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calificaciones_creador_idx" ON "calificaciones" USING btree ("creador_id");--> statement-breakpoint
CREATE INDEX "calificaciones_tematica_idx" ON "calificaciones" USING btree ("tematica_id");--> statement-breakpoint
CREATE INDEX "calificaciones_resultado_idx" ON "calificaciones" USING btree ("resultado");--> statement-breakpoint
CREATE UNIQUE INDEX "candidatos_external_id_idx" ON "candidatos" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "candidatos_creador_idx" ON "candidatos" USING btree ("creador_id");--> statement-breakpoint
CREATE INDEX "candidatos_tematica_idx" ON "candidatos" USING btree ("tematica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "colecciones_nombre_idx" ON "colecciones" USING btree (lower("nombre"));--> statement-breakpoint
CREATE INDEX "descartes_tematica_idx" ON "descartes" USING btree ("tematica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guiones_limpios_video_idx" ON "guiones_limpios" USING btree ("red","external_id");--> statement-breakpoint
CREATE INDEX "guiones_limpios_creador_idx" ON "guiones_limpios" USING btree ("creador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referentes_red_handle_idx" ON "referentes" USING btree ("red",lower("handle"));--> statement-breakpoint
CREATE INDEX "referentes_sugeridos_estado_idx" ON "referentes_sugeridos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "referentes_tematicas_tematica_idx" ON "referentes_tematicas" USING btree ("tematica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tematicas_creador_nombre_idx" ON "tematicas" USING btree ("creador_id",lower("nombre"));--> statement-breakpoint
CREATE INDEX "tematicas_creador_idx" ON "tematicas" USING btree ("creador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcripciones_video_idx" ON "transcripciones" USING btree ("red","external_id");--> statement-breakpoint
CREATE INDEX "transcripciones_tanda_idx" ON "transcripciones" USING btree ("tanda_id");--> statement-breakpoint
CREATE UNIQUE INDEX "traslado_cockpit_ref_idx" ON "traslado_cockpit" USING btree ("tabla","ref_cockpit");--> statement-breakpoint
CREATE INDEX "traslado_cockpit_fila_idx" ON "traslado_cockpit" USING btree ("tabla","fila_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_grabados_video_idx" ON "videos_grabados" USING btree ("red","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_referentes_video_idx" ON "videos_referentes" USING btree ("red","external_id");--> statement-breakpoint
ALTER TABLE "calificaciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidatos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "colecciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "colecciones_videos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "descartes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guiones_limpios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referentes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referentes_sugeridos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referentes_sugeridos_tematicas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referentes_tematicas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tandas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tematicas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcripciones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "traslado_cockpit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "videos_grabados" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "videos_referentes" ENABLE ROW LEVEL SECURITY;
