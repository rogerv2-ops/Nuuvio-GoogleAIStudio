CREATE TABLE "geo_territorios" (
	"codigo" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"nivel" text NOT NULL,
	"codigo_padre" text,
	"departamento" text NOT NULL,
	"provincia" text NOT NULL,
	"activo" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
