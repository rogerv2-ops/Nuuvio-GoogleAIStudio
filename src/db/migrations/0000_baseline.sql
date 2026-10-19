CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audience_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_idx" text,
	"nombre" text NOT NULL,
	"apellido" text,
	"telefono" text,
	"telefono_idx" text,
	"distrito" text,
	"provincia" text,
	"ciudad" text,
	"email_verificado" boolean DEFAULT false,
	"verification_token" text,
	"codigo_ref" text,
	"puntos_saldo" integer DEFAULT 0,
	"estado" text DEFAULT 'pendiente',
	"categorias_interes" jsonb,
	"consentimientos" jsonb,
	"utm" jsonb,
	"registrado_en" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"password_salt" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" text NOT NULL,
	"usuario_id" text,
	"merchant_id" text,
	"descripcion" text,
	"totp_secret" text,
	"totp_habilitado" boolean DEFAULT false,
	"totp_backup_hashes" jsonb DEFAULT '[]'::jsonb,
	"totp_activado_en" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" text PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"subtitulo" text NOT NULL,
	"imagen_url" text NOT NULL,
	"enlace_url" text,
	"activado" boolean DEFAULT true,
	"orden" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"canal" text NOT NULL,
	"direccion" text NOT NULL,
	"telefono" text NOT NULL,
	"contenido" text NOT NULL,
	"estado" text NOT NULL,
	"detalles" text,
	"timestamp" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "click_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"oferta_id" text NOT NULL,
	"comercio_id" text NOT NULL,
	"usuario_telefono" text NOT NULL,
	"codigo_canje" text NOT NULL,
	"facturable" boolean DEFAULT true,
	"creado_en" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "click_packs" (
	"id" text PRIMARY KEY NOT NULL,
	"comercio_id" text NOT NULL,
	"total_clics" integer NOT NULL,
	"saldo_clics" integer NOT NULL,
	"precio_unitario" numeric NOT NULL,
	"monto_total" numeric NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"comprado_en" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"timestamp" text NOT NULL,
	"verification_token" text,
	"verification_link" text,
	"whatsapp_link" text,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo_url" text NOT NULL,
	"comercio_id" text NOT NULL,
	"comercio_nombre" text NOT NULL,
	"comercio_whatsapp" text NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text NOT NULL,
	"tipo" text NOT NULL,
	"precio_normal" numeric NOT NULL,
	"precio_oferta" numeric NOT NULL,
	"stock" integer,
	"categoria" text NOT NULL,
	"distrito" text NOT NULL,
	"provincia" text NOT NULL,
	"lat" numeric NOT NULL,
	"lng" numeric NOT NULL,
	"imagenes" jsonb NOT NULL,
	"vence_en" text NOT NULL,
	"estado" text NOT NULL,
	"likes" integer DEFAULT 0,
	"vistas" integer DEFAULT 0,
	"clics" integer DEFAULT 0,
	"leads_calificados" integer DEFAULT 0,
	"video_url" text,
	"creada_en" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registration_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"telefono" text,
	"nombre" text,
	"status" text NOT NULL,
	"result_details" text,
	"timestamp" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "security_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"operador_id" text NOT NULL,
	"operador_nombre" text NOT NULL,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"detalles" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"email" text NOT NULL,
	"rol" text NOT NULL,
	"origen" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
