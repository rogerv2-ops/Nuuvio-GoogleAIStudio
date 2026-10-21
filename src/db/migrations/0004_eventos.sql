CREATE TABLE "eventos" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo_evento" text NOT NULL,
	"actor_tipo" text,
	"actor_id" text,
	"distrito" text,
	"provincia" text,
	"origen" text,
	"datos" jsonb DEFAULT '{}'::jsonb,
	"creado_en" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "eventos_tipo_creado_idx" ON "eventos" USING btree ("tipo_evento","creado_en");--> statement-breakpoint
CREATE INDEX "eventos_creado_idx" ON "eventos" USING btree ("creado_en");